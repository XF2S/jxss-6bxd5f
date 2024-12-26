package com.enrollment.application;

import com.enrollment.application.models.Application;
import com.enrollment.application.models.ApplicationStatus;
import com.enrollment.application.services.ApplicationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.*; // version: 5.9.2
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Comprehensive test suite for Application Service functionality
 * Validates core requirements including performance, security, and workflow automation
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ExtendWith(SpringExtension.class)
@Testcontainers
@ActiveProfiles("test")
public class ApplicationTests {

    private static final Logger LOGGER = LoggerFactory.getLogger(ApplicationTests.class);
    private static final Duration API_TIMEOUT = Duration.ofSeconds(3);
    private static final int CONCURRENT_USERS = 10;
    private static final String TEST_USER_ID = "test-user";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationService applicationService;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    private UUID testUserId;
    private ObjectNode testFormData;

    @BeforeEach
    void setUp() {
        testUserId = UUID.randomUUID();
        testFormData = createTestFormData();
    }

    @Test
    @DisplayName("Application creation should meet performance SLA")
    @Timeout(value = 3, unit = TimeUnit.SECONDS)
    void testApplicationCreationPerformance() {
        // Arrange
        Instant start = Instant.now();

        // Act
        Application application = applicationService.createApplication(testUserId, testFormData);

        // Assert
        Duration duration = Duration.between(start, Instant.now());
        assertNotNull(application, "Application should be created");
        assertTrue(duration.compareTo(API_TIMEOUT) < 0, 
            "Application creation should complete within " + API_TIMEOUT.toMillis() + "ms");
        assertEquals(ApplicationStatus.DRAFT, application.getStatus(), 
            "New application should be in DRAFT status");
    }

    @Test
    @DisplayName("Workflow automation should process applications efficiently")
    void testWorkflowAutomation() {
        // Arrange
        Application application = applicationService.createApplication(testUserId, testFormData);
        Instant start = Instant.now();

        // Act
        application = applicationService.submitApplication(application.getId());
        Duration processingTime = Duration.between(start, Instant.now());

        // Assert
        assertNotNull(application.getSubmittedAt(), "Submission timestamp should be set");
        assertEquals(ApplicationStatus.SUBMITTED, application.getStatus(), 
            "Application status should be SUBMITTED");
        assertTrue(processingTime.toSeconds() < 5, 
            "Workflow processing should complete within 5 seconds");
    }

    @Test
    @DisplayName("Should handle concurrent application submissions")
    void testConcurrentApplications() {
        // Arrange
        List<CompletableFuture<Application>> futures = new ArrayList<>();

        // Act
        IntStream.range(0, CONCURRENT_USERS).forEach(i -> {
            CompletableFuture<Application> future = CompletableFuture.supplyAsync(() -> {
                Application app = applicationService.createApplication(UUID.randomUUID(), testFormData);
                return applicationService.submitApplication(app.getId());
            });
            futures.add(future);
        });

        // Assert
        List<Application> applications = futures.stream()
            .map(CompletableFuture::join)
            .collect(Collectors.toList());

        assertEquals(CONCURRENT_USERS, applications.size(), 
            "All concurrent applications should be processed");
        applications.forEach(app -> 
            assertEquals(ApplicationStatus.SUBMITTED, app.getStatus(), 
                "All applications should be submitted successfully"));
    }

    @Test
    @DisplayName("Should enforce security constraints")
    @WithMockUser(roles = {"USER"})
    void testSecurityConstraints() throws Exception {
        // Arrange
        UUID applicationId = UUID.randomUUID();

        // Act & Assert
        mockMvc.perform(get("/api/applications/{id}", applicationId))
            .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/applications/{id}/status", applicationId)
            .contentType("application/json")
            .content("{\"status\": \"APPROVED\"}"))
            .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Should validate application data")
    void testApplicationValidation() {
        // Arrange
        ObjectNode invalidFormData = objectMapper.createObjectNode();

        // Act & Assert
        assertThrows(ValidationException.class, () -> 
            applicationService.createApplication(testUserId, invalidFormData),
            "Should reject invalid form data");
    }

    @Test
    @DisplayName("Should maintain data consistency during status transitions")
    void testStatusTransitionConsistency() {
        // Arrange
        Application application = applicationService.createApplication(testUserId, testFormData);

        // Act & Assert
        assertThrows(IllegalStateException.class, () -> 
            applicationService.updateApplicationStatus(
                application.getId(), 
                ApplicationStatus.APPROVED, 
                "Invalid transition"
            ),
            "Should prevent invalid status transitions"
        );
    }

    private ObjectNode createTestFormData() {
        ObjectNode formData = objectMapper.createObjectNode();
        formData.put("firstName", "John");
        formData.put("lastName", "Doe");
        formData.put("email", "john.doe@example.com");
        formData.put("program", "Computer Science");
        formData.put("term", "Fall 2024");
        return formData;
    }

    @AfterEach
    void tearDown() {
        // Cleanup test data if necessary
    }
}