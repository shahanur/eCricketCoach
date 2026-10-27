# GitHub Copilot Custom Instructions

## Project Architecture & Tech Stack
- **Decoupled Architecture:** The backend API and frontends (Web App and multiple Mobile App personas) are completely separate. Never mix backend server code with client-facing code.
- **API Communication:** All frontends communicate with the backend exclusively via HTTP requests using a centralized API client layer.
- **Multi-Persona Mobile Apps:** Mobile apps serve different roles (e.g., Customer, Partner/Driver, Admin). Role-based access control (RBAC) is enforced on the backend via JWT tokens; frontend apps only handle UI and persona-specific workflows.

## Code Standards
- **Clean Separation of Concerns:** Business logic belongs in services/controllers; UI components must remain focused on rendering and user interaction.
- **Environment Variables:** Never hardcode API URLs, secrets, or keys. Always use environment variables (`.env`).
- **Type Safety:** Use strict typing (TypeScript where applicable) for API request payloads and response DTOs.
- **Error Handling:** Implement consistent error management (e.g., centralized API error interceptors and user-friendly toast/alert notifications).
