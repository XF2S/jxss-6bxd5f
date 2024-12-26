package com.enrollment.reporting.services;

import com.enrollment.reporting.models.Report;
import com.enrollment.reporting.models.Report.ReportType;
import com.enrollment.reporting.models.Report.ReportFormat;
import com.enrollment.reporting.models.Report.ReportStatus;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.retry.annotation.Retryable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Service responsible for generating various types of reports in the enrollment system.
 * Implements asynchronous processing, caching, and optimized file export capabilities.
 * 
 * @version 1.0
 * @since 2024-01
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ReportGenerationService {

    private static final int BATCH_SIZE = 1000;
    private static final String CACHE_NAME = "reportCache";
    private static final int MAX_RETRY_ATTEMPTS = 3;

    private final JdbcTemplate jdbcTemplate;
    private final ReportGeneratorFactory reportGeneratorFactory;
    private final S3StorageService storageService;
    private final MetricsCollector metricsCollector;
    private final ReportCacheManager cacheManager;

    /**
     * Asynchronously generates a report with enhanced error handling and performance monitoring.
     *
     * @param report The report configuration to generate
     * @return CompletableFuture containing the generated report
     */
    @Async("reportTaskExecutor")
    @Transactional
    @Retryable(maxAttempts = MAX_RETRY_ATTEMPTS)
    public CompletableFuture<Report> generateReport(Report report) {
        log.info("Starting report generation for report ID: {}", report.getId());
        long startTime = System.currentTimeMillis();

        try {
            // Validate report configuration
            ValidationResult validation = report.validate();
            if (!validation.isValid()) {
                throw new ReportValidationException("Invalid report configuration: " + validation.getErrors());
            }

            // Update report status
            report.updateStatus(ReportStatus.GENERATING, null);
            
            // Get appropriate generator and generate data
            ReportGenerator generator = reportGeneratorFactory.getGenerator(report.getType());
            List<Map<String, Object>> data = generator.generateData(report.getQuery(), report.getParameters());
            
            // Export report to specified format
            String filePath = exportReport(report, data);
            report.setFilePath(filePath);
            report.setRowCount(data.size());
            
            // Update report status and metrics
            long executionTime = System.currentTimeMillis() - startTime;
            report.setExecutionTimeMs(executionTime);
            report.updateStatus(ReportStatus.COMPLETED, null);
            
            // Record metrics
            metricsCollector.recordReportGeneration(report.getType(), executionTime, data.size());
            
            log.info("Report generation completed for ID: {}, execution time: {}ms", report.getId(), executionTime);
            return CompletableFuture.completedFuture(report);

        } catch (Exception e) {
            log.error("Error generating report ID: {}", report.getId(), e);
            report.updateStatus(ReportStatus.FAILED, e.getMessage());
            throw new ReportGenerationException("Failed to generate report", e);
        }
    }

    /**
     * Exports report data to the specified format with optimized handling.
     *
     * @param report The report configuration
     * @param data The data to export
     * @return Path to the exported file
     */
    @Cacheable(value = CACHE_NAME, key = "#report.id", unless = "#result == null")
    private String exportReport(Report report, List<Map<String, Object>> data) {
        String fileName = generateFileName(report);
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

        try {
            switch (report.getFormat()) {
                case PDF:
                    exportToPdf(data, outputStream);
                    break;
                case EXCEL:
                    exportToExcel(data, outputStream);
                    break;
                case CSV:
                    exportToCsv(data, outputStream);
                    break;
                default:
                    throw new UnsupportedOperationException("Unsupported format: " + report.getFormat());
            }

            // Upload to S3 with compression
            return storageService.uploadReport(
                fileName,
                outputStream.toByteArray(),
                report.getFormat().toString().toLowerCase()
            );

        } catch (Exception e) {
            log.error("Error exporting report ID: {} to format: {}", report.getId(), report.getFormat(), e);
            throw new ReportExportException("Failed to export report", e);
        } finally {
            try {
                outputStream.close();
            } catch (Exception e) {
                log.warn("Error closing output stream", e);
            }
        }
    }

    /**
     * Exports data to PDF format with compression and optimization.
     */
    private void exportToPdf(List<Map<String, Object>> data, ByteArrayOutputStream outputStream) {
        try (PdfDocument pdf = new PdfDocument(new PdfWriter(outputStream))) {
            PdfReportGenerator pdfGenerator = new PdfReportGenerator(pdf);
            pdfGenerator.generateReport(data);
        }
    }

    /**
     * Exports data to Excel format with streaming support for large datasets.
     */
    private void exportToExcel(List<Map<String, Object>> data, ByteArrayOutputStream outputStream) {
        try (SXSSFWorkbook workbook = new SXSSFWorkbook(100)) { // Window size of 100 rows
            ExcelReportGenerator excelGenerator = new ExcelReportGenerator(workbook);
            excelGenerator.generateReport(data);
            workbook.write(outputStream);
        } catch (Exception e) {
            throw new ReportExportException("Failed to export to Excel", e);
        }
    }

    /**
     * Exports data to CSV format with streaming and efficient memory usage.
     */
    private void exportToCsv(List<Map<String, Object>> data, ByteArrayOutputStream outputStream) {
        CsvReportGenerator csvGenerator = new CsvReportGenerator(outputStream);
        csvGenerator.generateReport(data);
    }

    /**
     * Generates a unique file name for the report.
     */
    private String generateFileName(Report report) {
        return String.format(
            "report_%s_%s_%s.%s",
            report.getId(),
            report.getType().toString().toLowerCase(),
            LocalDateTime.now().toString().replace(":", "-"),
            report.getFormat().toString().toLowerCase()
        );
    }

    /**
     * Retrieves the current status of a report.
     */
    @Cacheable(value = CACHE_NAME, key = "#reportId")
    public Report getReportStatus(String reportId) {
        return jdbcTemplate.queryForObject(
            "SELECT * FROM reports WHERE id = ?",
            new ReportRowMapper(),
            reportId
        );
    }

    /**
     * Cleans up old report files and cache entries.
     */
    @Async
    @Scheduled(cron = "0 0 1 * * ?") // Run at 1 AM daily
    public void cleanupOldReports() {
        log.info("Starting report cleanup task");
        try {
            // Clean up old files from S3
            storageService.deleteOldReports(30); // Keep reports for 30 days
            
            // Clear old cache entries
            cacheManager.evictOldEntries(CACHE_NAME);
            
            log.info("Report cleanup completed successfully");
        } catch (Exception e) {
            log.error("Error during report cleanup", e);
        }
    }
}