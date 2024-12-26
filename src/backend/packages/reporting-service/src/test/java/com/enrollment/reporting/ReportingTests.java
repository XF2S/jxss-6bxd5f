package com.enrollment.reporting;

import com.enrollment.reporting.models.Report;
import com.enrollment.reporting.models.Report.ReportType;
import com.enrollment.reporting.models.Report.ReportFormat;
import com.enrollment.reporting.models.Report.ReportStatus;
import com.enrollment.reporting.services.ReportGenerationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.mockito.Mock;
import org.awaitility.Awaitility;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.awaitility.Awaitility.await;

/**
 * Comprehensive test suite for the Reporting Service
 * Tests report generation, performance, and export functionality
 * 
 * @version 1.0
 * @since 2024-01
 */
@SpringBootTest(classes = ReportingApplication.class)
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@ActiveProfiles("test")
public class ReportingTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ReportGenerationService reportGenerationService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TestRestTemplate restTemplate;

    @Mock
    private Clock clock;

    private static final int PERFORMANCE_THRESHOLD_MS = 3000; // 3 seconds per spec
    private static final int TEST_DATA_SIZE = 10000;
    private Map<String, Object> testParameters;

    @BeforeEach
    void setUp() {
        // Reset mocks and prepare test data
        reset(clock);
        when(clock.instant()).thenReturn(Clock.systemUTC().instant());

        testParameters = new HashMap<>();
        testParameters.put("startDate", LocalDateTime.now().minusDays(30));
        testParameters.put("endDate", LocalDateTime.now());
        testParameters.put("programType", "Undergraduate");
    }

    @Test
    @DisplayName("Test Standard Report Generation Performance")
    @Timeout(value = 5, unit = TimeUnit.SECONDS)
    void testStandardReportGenerationPerformance() throws Exception {
        // Arrange
        Report report = Report.builder()
            .id(UUID.randomUUID())
            .name("Enrollment Statistics Report")
            .type(ReportType.ENROLLMENT_STATISTICS)
            .format(ReportFormat.PDF)
            .parameters(testParameters)
            .createdBy("test-user")
            .status(ReportStatus.PENDING)
            .build();

        // Act
        long startTime = System.currentTimeMillis();
        CompletableFuture<Report> futureReport = reportGenerationService.generateReport(report);
        
        // Assert
        Report completedReport = futureReport.get(PERFORMANCE_THRESHOLD_MS, TimeUnit.MILLISECONDS);
        long executionTime = System.currentTimeMillis() - startTime;

        assertNotNull(completedReport);
        assertEquals(ReportStatus.COMPLETED, completedReport.getStatus());
        assertTrue(executionTime < PERFORMANCE_THRESHOLD_MS, 
            "Report generation exceeded performance threshold of " + PERFORMANCE_THRESHOLD_MS + "ms");
        assertNotNull(completedReport.getFilePath());
    }

    @Test
    @DisplayName("Test Custom Report Generation")
    void testCustomReportGeneration() throws Exception {
        // Arrange
        String customQuery = "SELECT a.status, COUNT(*) as count " +
                           "FROM applications a " +
                           "WHERE a.submitted_at BETWEEN :startDate AND :endDate " +
                           "GROUP BY a.status";

        Report customReport = Report.builder()
            .id(UUID.randomUUID())
            .name("Custom Application Status Report")
            .type(ReportType.CUSTOM)
            .format(ReportFormat.EXCEL)
            .query(customQuery)
            .parameters(testParameters)
            .createdBy("test-user")
            .status(ReportStatus.PENDING)
            .build();

        // Act
        CompletableFuture<Report> futureReport = reportGenerationService.generateReport(customReport);

        // Assert
        await().atMost(5, TimeUnit.SECONDS)
            .pollInterval(Duration.ofMillis(100))
            .until(() -> {
                Report status = reportGenerationService.getReportStatus(customReport.getId().toString());
                return status.getStatus() == ReportStatus.COMPLETED;
            });

        Report completedReport = futureReport.get();
        assertNotNull(completedReport.getExecutionTimeMs());
        assertTrue(completedReport.getRowCount() > 0);
        assertEquals(ReportFormat.EXCEL, completedReport.getFormat());
    }

    @Test
    @DisplayName("Test Report Generation Error Handling")
    void testReportGenerationErrorHandling() {
        // Arrange
        Report invalidReport = Report.builder()
            .id(UUID.randomUUID())
            .name("Invalid Report")
            .type(ReportType.APPLICATION_SUMMARY)
            .format(ReportFormat.PDF)
            .query("INVALID SQL QUERY")
            .parameters(new HashMap<>())
            .createdBy("test-user")
            .status(ReportStatus.PENDING)
            .build();

        // Act & Assert
        CompletableFuture<Report> futureReport = reportGenerationService.generateReport(invalidReport);
        
        Exception exception = assertThrows(Exception.class, () -> futureReport.get());
        assertTrue(exception.getCause() instanceof ReportGenerationException);
        
        Report failedReport = reportGenerationService.getReportStatus(invalidReport.getId().toString());
        assertEquals(ReportStatus.FAILED, failedReport.getStatus());
        assertNotNull(failedReport.getErrorMessage());
    }

    @Test
    @DisplayName("Test Report Export Formats")
    void testReportExportFormats() throws Exception {
        // Test PDF Export
        testReportExport(ReportFormat.PDF, "application/pdf");
        
        // Test Excel Export
        testReportExport(ReportFormat.EXCEL, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        
        // Test CSV Export
        testReportExport(ReportFormat.CSV, "text/csv");
    }

    private void testReportExport(ReportFormat format, String expectedContentType) throws Exception {
        // Arrange
        Report report = Report.builder()
            .id(UUID.randomUUID())
            .name("Export Test Report")
            .type(ReportType.WORKFLOW_ANALYTICS)
            .format(format)
            .parameters(testParameters)
            .createdBy("test-user")
            .status(ReportStatus.PENDING)
            .build();

        // Act
        CompletableFuture<Report> futureReport = reportGenerationService.generateReport(report);
        Report completedReport = futureReport.get(5, TimeUnit.SECONDS);

        // Assert
        assertNotNull(completedReport.getFilePath());
        assertTrue(completedReport.getFilePath().endsWith(format.toString().toLowerCase()));
        
        // Verify file content type
        String fileUrl = completedReport.getFilePath();
        var response = restTemplate.getForEntity(fileUrl, byte[].class);
        assertEquals(expectedContentType, response.getHeaders().getContentType().toString());
    }

    @Test
    @DisplayName("Test Concurrent Report Generation")
    void testConcurrentReportGeneration() {
        // Arrange
        int concurrentReports = 5;
        List<CompletableFuture<Report>> futures = new ArrayList<>();

        // Act
        for (int i = 0; i < concurrentReports; i++) {
            Report report = Report.builder()
                .id(UUID.randomUUID())
                .name("Concurrent Report " + i)
                .type(ReportType.ENROLLMENT_STATISTICS)
                .format(ReportFormat.PDF)
                .parameters(testParameters)
                .createdBy("test-user")
                .status(ReportStatus.PENDING)
                .build();

            futures.add(reportGenerationService.generateReport(report));
        }

        // Assert
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
            .thenAccept(v -> {
                futures.forEach(f -> {
                    try {
                        Report report = f.get();
                        assertEquals(ReportStatus.COMPLETED, report.getStatus());
                        assertNotNull(report.getExecutionTimeMs());
                    } catch (Exception e) {
                        fail("Concurrent report generation failed: " + e.getMessage());
                    }
                });
            });
    }

    @Test
    @DisplayName("Test Report Validation")
    void testReportValidation() {
        // Test missing required parameters
        Report invalidReport = Report.builder()
            .id(UUID.randomUUID())
            .name("")  // Invalid: empty name
            .type(ReportType.APPLICATION_SUMMARY)
            .format(ReportFormat.PDF)
            .createdBy("test-user")
            .status(ReportStatus.PENDING)
            .build();

        ValidationResult validation = invalidReport.validate();
        assertFalse(validation.isValid());
        assertTrue(validation.getErrors().contains("Name is required"));

        // Test valid report
        Report validReport = Report.builder()
            .id(UUID.randomUUID())
            .name("Valid Report")
            .type(ReportType.APPLICATION_SUMMARY)
            .format(ReportFormat.PDF)
            .parameters(testParameters)
            .createdBy("test-user")
            .status(ReportStatus.PENDING)
            .build();

        validation = validReport.validate();
        assertTrue(validation.isValid());
        assertTrue(validation.getErrors().isEmpty());
    }
}