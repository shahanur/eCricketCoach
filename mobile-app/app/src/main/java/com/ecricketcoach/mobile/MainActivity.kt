package com.ecricketcoach.mobile

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.browser.customtabs.CustomTabsIntent
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

private val Indigo = Color(0xFFB6A3FF)
private val Green = Color(0xFF58C288)
private val Night = Color(0xFF090D16)
private val Panel = Color(0xFF151B27)
private val Orchid = Color(0xFF7C5CFA)
private val Blossom = Color(0xFFF3F0FC)

class MainActivity : ComponentActivity() {
    private lateinit var store: AuthStore
    private lateinit var api: CoachApi
    private var sessionRevision by mutableIntStateOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        store = AuthStore(applicationContext)
        api = CoachApi(BuildConfig.API_BASE_URL, BuildConfig.OAUTH_ORIGIN)
        handleCallback(intent)
        setContent {
            CoachApp(
                store, api, sessionRevision,
                openSignIn = { provider ->
                    if (provider == "google") signInWithGoogle()
                    else CustomTabsIntent.Builder().build().launchUrl(this, Uri.parse(api.signInUrl(provider)))
                },
                clearCredentialState = {
                    CredentialManager.create(this).clearCredentialState(ClearCredentialStateRequest())
                }
            )
        }
    }

    private suspend fun signInWithGoogle() {
        val challenge = api.getGoogleSignInChallenge()
        val option = GetSignInWithGoogleOption.Builder(challenge.clientId)
            .setNonce(challenge.nonce)
            .build()
        val result = CredentialManager.create(this).getCredential(
            context = this,
            request = GetCredentialRequest.Builder().addCredentialOption(option).build()
        )
        val credential = result.credential
        require(credential is CustomCredential &&
            credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            "Google returned an unsupported credential."
        }
        val googleToken = GoogleIdTokenCredential.createFrom(credential.data)
        val session = api.signInWithGoogle(googleToken.idToken, challenge.challenge)
        store.saveSession(session.token, session.user)
        sessionRevision += 1
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleCallback(intent)
    }

    private fun handleCallback(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.toString().substringBefore('#') != CoachApi.MOBILE_CALLBACK) return
        val callbackQuery = Uri.parse("https://callback.invalid/?${uri.fragment.orEmpty()}")
        val token = callbackQuery.getQueryParameter("auth_token").orEmpty()
        val role = callbackQuery.getQueryParameter("role").orEmpty()
        if (token.isBlank() || role !in setOf("SUPER_ADMIN", "CLUB_ADMIN", "COACH", "PLAYER")) {
            Log.w("eCricketCoach", "Rejected an incomplete or unsupported sign-in callback.")
            return
        }
        val user = CoachUser(
            id = callbackQuery.getQueryParameter("userId") ?: "social-user",
            name = callbackQuery.getQueryParameter("name") ?: "eCricketCoach member",
            email = callbackQuery.getQueryParameter("email").orEmpty(),
            role = role,
            coachContext = callbackQuery.getQueryParameter("coachContext"),
            tenantId = callbackQuery.getQueryParameter("tenantId"),
            clubName = callbackQuery.getQueryParameter("clubName")
        )
        if (::store.isInitialized) store.saveSession(token, user)
        sessionRevision += 1
    }
}

@androidx.compose.runtime.Composable
private fun CoachApp(
    store: AuthStore,
    api: CoachApi,
    sessionRevision: Int,
    openSignIn: suspend (String) -> Unit,
    clearCredentialState: suspend () -> Unit
) {
    var user by remember { mutableStateOf(store.readUser()) }
    var token by remember { mutableStateOf(store.readToken()) }
    var providers by remember { mutableStateOf<Map<String, Boolean>>(emptyMap()) }
    val initialOwnerId = user?.tenantId ?: user?.id
    var drills by remember { mutableStateOf(store.readDrills(initialOwnerId)) }
    var templates by remember { mutableStateOf(store.readTemplates(initialOwnerId)) }
    var selectedTab by remember { mutableStateOf("Drills") }
    var isDark by remember { mutableStateOf(true) }
    var refreshing by remember { mutableStateOf(false) }
    var offline by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var signingIn by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val coachAccess = user?.role in setOf("SUPER_ADMIN", "CLUB_ADMIN", "COACH")
    val colors = if (isDark) darkColorScheme(
        primary = Indigo,
        onPrimary = Color(0xFF101126),
        secondary = Color(0xFFFF93C0),
        tertiary = Color(0xFF57E6B0),
        background = Night,
        surface = Panel,
        surfaceVariant = Color(0xFF20283A),
        outline = Color(0xFF3A465D)
    ) else lightColorScheme(
        primary = Orchid,
        onPrimary = Color.White,
        secondary = Color(0xFFFF6FA8),
        tertiary = Color(0xFF1FB683),
        background = Blossom,
        surface = Color.White,
        surfaceVariant = Color(0xFFEDE8FB),
        outline = Color(0xFFD9D2F0)
    )

    suspend fun synchronize() {
        val sessionToken = token ?: return
        val ownerId = user?.tenantId ?: user?.id ?: return
        refreshing = true
        error = ""
        try {
            val latestDrills = api.getDrills(sessionToken, ownerId)
            drills = latestDrills
            store.saveDrills(ownerId, latestDrills)
            if (coachAccess) {
                val latestTemplates = api.getTemplates(sessionToken)
                templates = latestTemplates
                store.saveTemplates(ownerId, latestTemplates)
            }
            offline = false
        } catch (failure: Exception) {
            offline = drills.isNotEmpty() || templates.isNotEmpty()
            error = failure.message ?: "Unable to synchronize training data."
            if (failure is ApiException && failure.statusCode == 401) {
                store.clearSession()
                token = null
                user = null
            }
        } finally {
            refreshing = false
        }
    }

    LaunchedEffect(Unit) {
        try {
            providers = api.getProviders()
        } catch (failure: Exception) {
            error = failure.message ?: "Unable to connect to eCricketCoach."
        }
    }
    LaunchedEffect(sessionRevision) {
        if (sessionRevision > 0) {
            token = store.readToken()
            user = store.readUser()
            val ownerId = user?.tenantId ?: user?.id
            drills = store.readDrills(ownerId)
            templates = store.readTemplates(ownerId)
        }
    }
    LaunchedEffect(token, user?.role) {
        if (token != null) synchronize()
    }

    MaterialTheme(colorScheme = colors) {
        Surface(
            modifier = Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing),
            color = MaterialTheme.colorScheme.background
        ) {
            if (user == null || token == null) {
                SignInScreen(
                    providers = providers,
                    error = error,
                    signingIn = signingIn,
                    isDark = isDark,
                    onToggleTheme = { isDark = !isDark },
                    onSignIn = { provider ->
                        scope.launch {
                            signingIn = true
                            error = ""
                            try {
                                openSignIn(provider)
                            } catch (_: GetCredentialCancellationException) {
                                error = "Sign-in was cancelled."
                            } catch (failure: CancellationException) {
                                throw failure
                            } catch (failure: GetCredentialException) {
                                Log.w("eCricketCoach", "Native Google sign-in failed (${failure.type}).")
                                error = "Google sign-in failed. Check that a Google account is available and the Android OAuth client matches this app's signing certificate."
                            } catch (failure: Exception) {
                                Log.w("eCricketCoach", "Unable to complete sign-in (${failure.javaClass.simpleName}).")
                                error = failure.message ?: "Unable to complete sign-in."
                            } finally {
                                signingIn = false
                            }
                        }
                    }
                )
            } else {
                if (user?.role == "CLUB_ADMIN" || (user?.role == "COACH" && user?.coachContext == "CLUB")) {
                    user?.let { activeUser ->
                        ClubCoachWorkspace(
                            api = api,
                            store = store,
                            token = token.orEmpty(),
                            user = activeUser,
                            drills = drills,
                            templates = templates,
                            isDark = isDark,
                            onToggleTheme = { isDark = !isDark },
                            onSignOut = {
                                scope.launch {
                                    store.clearSession()
                                    token = null
                                    user = null
                                    error = ""
                                    try {
                                        clearCredentialState()
                                    } catch (failure: CancellationException) {
                                        throw failure
                                    } catch (failure: Exception) {
                                        Log.w(
                                            "eCricketCoach",
                                            "Unable to clear credential state (${failure.javaClass.simpleName})."
                                        )
                                        error = "Signed out locally, but Google account selection could not be reset. Please try again."
                                    }
                                }
                            }
                        )
                    }
                } else {
                Column(Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 18.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("eCricketCoach", fontSize = 22.sp, fontWeight = FontWeight.Bold)
                            Text(
                                user?.clubName?.takeIf(String::isNotBlank) ?: "CRICKET TRAINING",
                                color = Green,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.2.sp
                            )
                        }
                        TextButton(onClick = {
                            isDark = !isDark
                        }) { Text(if (isDark) "Light" else "Dark") }
                    }
                    Spacer(Modifier.height(22.dp))
                    Text("Welcome back,", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    Text(user?.name.orEmpty(), fontSize = 26.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(18.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        TabButton("Drills", drills.size, selectedTab == "Drills") { selectedTab = "Drills" }
                        if (coachAccess) {
                            TabButton("Templates", templates.size, selectedTab == "Templates") {
                                selectedTab = "Templates"
                            }
                        }
                    }
                    if (offline) {
                        Spacer(Modifier.height(10.dp))
                        Text("Offline · showing your last synchronized data", color = Green, fontSize = 12.sp)
                    }
                    if (error.isNotBlank()) {
                        Spacer(Modifier.height(8.dp))
                        Text(error, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                    }
                    Spacer(Modifier.height(12.dp))
                    if (refreshing && drills.isEmpty() && templates.isEmpty()) {
                        Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = Green)
                        }
                    } else if (selectedTab == "Templates" && coachAccess) {
                        TrainingTemplateList(templates, Modifier.weight(1f))
                    } else {
                        DrillList(drills, Modifier.weight(1f))
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        TextButton(onClick = { scope.launch { synchronize() } }, enabled = !refreshing) {
                            Text(if (refreshing) "Syncing…" else "Sync now")
                        }
                        TextButton(onClick = {
                            scope.launch {
                                store.clearSession()
                                token = null
                                user = null
                                error = ""
                                try {
                                    clearCredentialState()
                                } catch (failure: CancellationException) {
                                    throw failure
                                } catch (failure: Exception) {
                                    Log.w("eCricketCoach", "Unable to clear credential state (${failure.javaClass.simpleName}).")
                                    error = "Signed out locally, but Google account selection could not be reset. Please try again."
                                }
                            }
                        }) { Text("Sign out") }
                    }
                }
            }
        }
    }
}
}

@androidx.compose.runtime.Composable
private fun SignInScreen(
    providers: Map<String, Boolean>,
    error: String,
    signingIn: Boolean,
    isDark: Boolean,
    onToggleTheme: () -> Unit,
    onSignIn: (String) -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text("eCricketCoach", color = Green, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(10.dp))
        Text("Train with purpose.", fontSize = 30.sp, fontWeight = FontWeight.Bold)
        Text("Your coaching workspace, wherever you play.", color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
        Spacer(Modifier.height(30.dp))
        listOf("google" to "Continue with Google", "microsoft" to "Continue with Microsoft", "apple" to "Continue with Apple")
            .filter { providers[it.first] == true }
            .forEach { (provider, label) ->
                Button(
                    onClick = { onSignIn(provider) },
                    enabled = !signingIn,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp)
                ) { Text(label) }
            }
        if (signingIn) {
            CircularProgressIndicator(modifier = Modifier.padding(vertical = 12.dp))
        }
        if (providers.isNotEmpty() && providers.values.none { it }) {
            Text(
                "No sign-in provider is configured. Configure an identity provider on the eCricketCoach API, then retry.",
                color = MaterialTheme.colorScheme.error,
                fontSize = 13.sp
            )
        }
        if (error.isNotBlank()) {
            Spacer(Modifier.height(12.dp))
            Text(error, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }
        Spacer(Modifier.height(16.dp))
        TextButton(onClick = onToggleTheme, modifier = Modifier.align(Alignment.End)) {
            Text(if (isDark) "Switch to light theme" else "Switch to dark theme")
        }
    }
}

@androidx.compose.runtime.Composable
private fun TabButton(title: String, count: Int, selected: Boolean, onClick: () -> Unit) {
    val background = if (selected) Green else MaterialTheme.colorScheme.surface
    val foreground = if (selected) Color(0xFF092014) else MaterialTheme.colorScheme.onSurface
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        color = background,
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(title, color = foreground, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.width(8.dp))
            Text(count.toString(), color = foreground.copy(alpha = 0.75f), fontSize = 12.sp)
        }
    }
}

@androidx.compose.runtime.Composable
private fun DrillList(drills: List<Drill>, modifier: Modifier = Modifier) {
    if (drills.isEmpty()) {
        EmptyState("No drills to show yet", "Sync while online to load the shared drill catalogue.", modifier)
        return
    }
    LazyColumn(modifier = modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items(drills, key = Drill::id) { drill ->
            ContentCard(
                title = drill.title,
                eyebrow = "${drill.discipline} · ${drill.durationMinutes} min",
                details = listOf(drill.skillSet, drill.instructions).filter(String::isNotBlank).joinToString("\n")
            )
        }
    }
}

@androidx.compose.runtime.Composable
private fun TrainingTemplateList(templates: List<TrainingTemplate>, modifier: Modifier = Modifier) {
    if (templates.isEmpty()) {
        EmptyState("No templates to show yet", "Shared coaching templates will appear here after a sync.", modifier)
        return
    }
    LazyColumn(modifier = modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items(templates, key = TrainingTemplate::id) { template ->
            ContentCard(
                title = template.title,
                eyebrow = "${template.durationMinutes} min · ${template.disciplines.joinToString()}",
                details = template.focus
            )
        }
    }
}

@androidx.compose.runtime.Composable
private fun ContentCard(title: String, eyebrow: String, details: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(eyebrow, color = Green, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(5.dp))
            Text(title, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            if (details.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(details, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.72f), fontSize = 13.sp)
            }
        }
    }
}

@androidx.compose.runtime.Composable
private fun EmptyState(title: String, detail: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(title, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(6.dp))
        Text(detail, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f), fontSize = 13.sp)
    }
}
