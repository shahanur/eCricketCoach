app/
└── src/
    ├── main/
    │   ├── AndroidManifest.xml
    │   ├── java/com/yourdomain/appname/   # (Or kotlin/ directory)
    │   │   ├── di/                      # Dependency Injection (Hilt / Dagger modules)
    │   │   ├── data/                    # Data Layer (Repositories, Local/Remote data sources)
    │   │   │   ├── api/                 # Retrofit / Ktor network interfaces & DTOs
    │   │   │   ├── database/            # Room Database, entities, and DAOs
    │   │   │   ├── datastore/           # Preferences DataStore or SharedPreferences
    │   │   │   └── repository/          # Repository implementations
    │   │   │
    │   │   ├── domain/                  # Domain Layer (Pure business logic, NO Android framework dependencies)
    │   │   │   ├── model/               # Core business models / domain entities
    │   │   │   ├── repository/          # Repository interfaces (contracts)
    │   │   │   └── usecase/             # Use cases / Interactors (e.g., GetUserUseCase.kt)
    │   │   │
    │   │   ├── presentation/            # Presentation Layer (UI, ViewModels, Activities, Fragments, Composables)
    │   │   │   ├── common/              # Shared UI components, base classes, extensions
    │   │   │   ├── home/                # Feature package: Home
    │   │   │   │   ├── HomeActivity.kt / HomeFragment.kt / HomeScreen.kt (Compose)
    │   │   │   │   ├── HomeViewModel.kt
    │   │   │   │   └── HomeState.kt     # UI state representation
    │   │   │   └── profile/             # Feature package: Profile
    │   │   │       ├── ProfileScreen.kt
    │   │   │       └── ProfileViewModel.kt
    │   │   │
    │   │   ├── utils/                   # Global helpers, extension functions, constants
    │   │   └── MyApplication.kt         # Application class annotated with @HiltAndroidApp (if using Hilt)
    │   │
    │   └── res/                         # Android resources
    │       ├── drawable/
    │       ├── layout/                  # XML layouts (if not 100% Jetpack Compose)
    │       ├── values/                  # strings.xml, colors.xml, themes.xml
    │       └── navigation/              # Navigation graphs (Jetpack Navigation)
    │
    ├── test/                            # Unit tests (JUnit, Mockito, Turbine, Coroutines test)
    └── androidTest/                     # Instrumented UI tests (Espresso, Compose UI test)
## Implementation notes (eCricketCoach)

Package root: `com.ecricketcoach.mobile`. Application class: `ECricketCoachApp` (`@HiltAndroidApp`); entry point: `presentation/MainActivity` (`@AndroidEntryPoint`).

- `di/` – Hilt modules binding repository interfaces to implementations and providing `CoachApi`/`AuthStore`.
- `data/api` – `CoachApi` HTTP client + payload builders; `data/datastore` – `AuthStore` (encrypted session + offline queue); `data/repository` – repository implementations.
- `domain/model`, `domain/repository` (contracts), `domain/usecase` (e.g. `AssignMemberToSquadUseCase`, `CompleteOAuthCallbackUseCase`, `SyncOfflineMutationsUseCase`).
- `presentation/` – feature packages `auth`, `home`, `club`, `analysis`, `assessment`, `session`, `squad`, `common` (theme + shared components) with `AuthViewModel`, `HomeViewModel`, `ClubWorkspaceViewModel`.
- `utils/` – formatting, date/time and session-plan helpers.

Known compromises:
- Domain models and repository signatures still use `org.json.JSONObject`; `AnalysisRepository` exposes `android.net.Uri`/`java.io.File` for video upload.
- `data/database/` (Room) is not used – offline state is persisted via `AuthStore`.
- No Jetpack Navigation graph; ViewModels are activity-scoped and some child panels call repository interfaces directly.
