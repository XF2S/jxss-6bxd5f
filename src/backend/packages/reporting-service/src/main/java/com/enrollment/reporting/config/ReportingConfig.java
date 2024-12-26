package com.enrollment.reporting.config;

import com.enrollment.reporting.models.Report.ReportType;
import com.enrollment.reporting.models.Report.ReportFormat;
import com.zaxxer.hikari.HikariDataSource;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.core.task.TaskDecorator;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import java.util.concurrent.RejectedExecutionHandler;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * Enhanced configuration class for the reporting service with performance optimizations.
 * Provides optimized beans for database connection pooling, async execution, and report generation.
 *
 * @version 1.0
 * @since 2024-01
 */
@Configuration
@EnableConfigurationProperties(ReportingProperties.class)
@EnableTransactionManagement
@RequiredArgsConstructor
public class ReportingConfig {

    private final ReportingProperties reportingProperties;
    private final MeterRegistry meterRegistry;

    /**
     * Configures and provides an optimized HikariCP datasource with performance tuning.
     * Implements connection pooling best practices for report generation workloads.
     *
     * @return Configured HikariDataSource
     */
    @Bean
    public HikariDataSource dataSource() {
        HikariDataSource dataSource = new HikariDataSource();
        
        // Core pool configuration
        dataSource.setDriverClassName(reportingProperties.getDatabase().getDriverClassName());
        dataSource.setJdbcUrl(reportingProperties.getDatabase().getUrl());
        dataSource.setUsername(reportingProperties.getDatabase().getUsername());
        dataSource.setPassword(reportingProperties.getDatabase().getPassword());
        
        // Performance optimization settings
        dataSource.setMaximumPoolSize(20); // Optimized for report generation workload
        dataSource.setMinimumIdle(5);
        dataSource.setIdleTimeout(300000); // 5 minutes
        dataSource.setConnectionTimeout(30000); // 30 seconds
        dataSource.setMaxLifetime(1800000); // 30 minutes
        
        // Connection leak detection
        dataSource.setLeakDetectionThreshold(60000); // 1 minute
        
        // Statement caching
        dataSource.addDataSourceProperty("cachePrepStmts", "true");
        dataSource.addDataSourceProperty("prepStmtCacheSize", "250");
        dataSource.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");
        
        // Performance monitoring
        dataSource.setMetricRegistry(meterRegistry);
        
        return dataSource;
    }

    /**
     * Configures optimized async task executor for report generation.
     * Implements thread pool best practices for handling concurrent report requests.
     *
     * @return Configured ThreadPoolTaskExecutor
     */
    @Bean
    public ThreadPoolTaskExecutor reportTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        
        // Core thread configuration
        int processors = Runtime.getRuntime().availableProcessors();
        executor.setCorePoolSize(processors);
        executor.setMaxPoolSize(processors * 2);
        executor.setQueueCapacity(100);
        
        // Thread configuration
        executor.setThreadNamePrefix("report-executor-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        
        // Task decoration for metrics
        executor.setTaskDecorator(new MetricsTaskDecorator(meterRegistry));
        
        // Shutdown configuration
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        
        executor.initialize();
        return executor;
    }

    /**
     * Provides enhanced factory for creating report generators with caching.
     * Configures optimized report generation strategies based on report type.
     *
     * @param jdbcTemplate JdbcTemplate for database operations
     * @return Configured ReportGeneratorFactory
     */
    @Bean
    public ReportGeneratorFactory reportGeneratorFactory(JdbcTemplate jdbcTemplate) {
        ReportGeneratorFactory factory = new ReportGeneratorFactory(jdbcTemplate, meterRegistry);
        
        // Configure template caching
        factory.setTemplateCacheSize(50);
        factory.setEnableParallelProcessing(true);
        
        // Register optimized generators for each report type
        factory.registerGenerator(
            ReportType.APPLICATION_SUMMARY,
            new ApplicationSummaryGenerator(jdbcTemplate, reportTaskExecutor())
        );
        factory.registerGenerator(
            ReportType.WORKFLOW_ANALYTICS,
            new WorkflowAnalyticsGenerator(jdbcTemplate, reportTaskExecutor())
        );
        factory.registerGenerator(
            ReportType.ENROLLMENT_STATISTICS,
            new EnrollmentStatisticsGenerator(jdbcTemplate, reportTaskExecutor())
        );
        factory.registerGenerator(
            ReportType.CUSTOM,
            new CustomReportGenerator(jdbcTemplate, reportTaskExecutor())
        );
        
        // Configure format processors
        factory.registerFormatProcessor(ReportFormat.PDF, new PDFProcessor());
        factory.registerFormatProcessor(ReportFormat.EXCEL, new ExcelProcessor());
        factory.registerFormatProcessor(ReportFormat.CSV, new CSVProcessor());
        
        return factory;
    }

    /**
     * Task decorator for adding metrics to async report generation tasks.
     */
    private static class MetricsTaskDecorator implements TaskDecorator {
        private final MeterRegistry meterRegistry;

        public MetricsTaskDecorator(MeterRegistry meterRegistry) {
            this.meterRegistry = meterRegistry;
        }

        @Override
        public Runnable decorate(Runnable task) {
            return () -> {
                long startTime = System.currentTimeMillis();
                try {
                    task.run();
                } finally {
                    long duration = System.currentTimeMillis() - startTime;
                    meterRegistry.timer("report.generation.duration")
                        .record(duration, java.util.concurrent.TimeUnit.MILLISECONDS);
                }
            };
        }
    }
}