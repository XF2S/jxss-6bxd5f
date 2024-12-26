package com.enrollment.application.config;

import com.enrollment.application.models.Application;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import io.micrometer.core.aop.TimedAspect;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;

import javax.sql.DataSource;
import java.time.Duration;

/**
 * Configuration class for Application Service with enhanced performance and monitoring capabilities.
 * Implements optimized database connections, caching, and performance monitoring.
 *
 * @version 1.0
 */
@Configuration
@EnableCaching
@EnableJpaRepositories(basePackages = "com.enrollment.application.repositories")
@EntityScan(basePackages = "com.enrollment.application.models")
@EnableConfigurationProperties
public class ApplicationConfig {

    @Value("${spring.application.name:enrollment-application-service}")
    private String applicationName;

    @Value("${spring.datasource.hikari.maximum-pool-size:20}")
    private int maxPoolSize;

    @Value("${spring.cache.redis.time-to-live:1800}")
    private int cacheTimeToLive;

    /**
     * Configures HikariCP datasource with optimized settings for high performance.
     * Implements connection pooling with monitoring capabilities.
     *
     * @return Configured HikariDataSource
     */
    @Bean
    @Primary
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();
        
        // Essential connection settings
        config.setJdbcUrl("${spring.datasource.url}");
        config.setUsername("${spring.datasource.username}");
        config.setPassword("${spring.datasource.password}");
        
        // Performance optimization settings
        config.setMaximumPoolSize(maxPoolSize);
        config.setMinimumIdle(5);
        config.setIdleTimeout(300000); // 5 minutes
        config.setConnectionTimeout(30000); // 30 seconds
        config.setMaxLifetime(1800000); // 30 minutes
        
        // Connection pool validation
        config.setValidationTimeout(5000); // 5 seconds
        config.setLeakDetectionThreshold(60000); // 1 minute
        
        // Performance monitoring
        config.setRegisterMbeans(true);
        config.setPoolName(applicationName + "-pool");
        
        // Statement caching
        config.addDataSourceProperty("cachePrepStmts", "true");
        config.addDataSourceProperty("prepStmtCacheSize", "250");
        config.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");
        
        return new HikariDataSource(config);
    }

    /**
     * Configures Redis cache manager with optimized settings for application caching.
     *
     * @param redisConnectionFactory Redis connection factory
     * @return Configured RedisCacheManager
     */
    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory redisConnectionFactory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofSeconds(cacheTimeToLive))
            .serializeValuesWith(
                RedisSerializationContext.SerializationPair.fromSerializer(
                    new GenericJackson2JsonRedisSerializer()
                )
            )
            .disableCachingNullValues()
            .prefixCacheNameWith(applicationName + ":");

        return RedisCacheManager.builder(redisConnectionFactory)
            .cacheDefaults(config)
            .transactionAware()
            .enableStatistics()
            .build();
    }

    /**
     * Configures ObjectMapper with custom serialization settings.
     *
     * @return Configured ObjectMapper
     */
    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.findAndRegisterModules();
        return mapper;
    }

    /**
     * Configures performance monitoring aspect for timing metrics.
     *
     * @param registry Meter registry for metrics collection
     * @return Configured TimedAspect
     */
    @Bean
    public TimedAspect timedAspect(MeterRegistry registry) {
        return new TimedAspect(registry, 
            timer -> timer.tags("application", applicationName));
    }

    /**
     * Configures custom performance monitoring for application processing.
     *
     * @param registry Meter registry for metrics collection
     * @return Configured MeterBinder
     */
    @Bean
    public MeterBinder applicationMetrics(MeterRegistry registry) {
        return registry -> {
            registry.gauge("application.processing.active", 
                registry.counter("application.processing.total"));
            registry.gauge("application.processing.queue.size", 
                registry.counter("application.processing.queued"));
        };
    }
}