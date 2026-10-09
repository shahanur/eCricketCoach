package com.ecricketcoach.mobile

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Assessment
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.foundation.Image
import androidx.compose.ui.res.painterResource
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
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
    val scheme = MaterialTheme.colorScheme
    val muted = scheme.onBackground.copy(alpha = 0.68f)
    val enabledProviders = listOf(
        SignInProvider("google", "Continue with Google", "G", Color(0xFF4285F4)),
        SignInProvider("microsoft", "Continue with Microsoft", "M", Color(0xFF00A4EF)),
        SignInProvider("apple", "Continue with Apple", "A", if (isDark) Color.White else Color.Black)
    ).filter { providers[it.id] == true }

    Box(
        Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(scheme.primary.copy(alpha = if (isDark) 0.22f else 0.16f), scheme.background, scheme.background)
                )
            )
    ) {
        IconButton(onClick = onToggleTheme, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp)) {
            Icon(
                if (isDark) Icons.Outlined.LightMode else Icons.Outlined.DarkMode,
                contentDescription = if (isDark) "Switch to light theme" else "Switch to dark theme",
                tint = scheme.onBackground.copy(alpha = 0.8f)
            )
        }
        Column(
            modifier = Modifier
                .align(Alignment.Center)
                .widthIn(max = 460.dp)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 48.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Image(
                painter = painterResource(R.drawable.ic_launcher),
                contentDescription = "eCricketCoach",
                modifier = Modifier.size(84.dp).clip(RoundedCornerShape(24.dp))
            )
            Spacer(Modifier.height(18.dp))
            Text("eCricketCoach", fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, color = scheme.onBackground)
            Spacer(Modifier.height(6.dp))
            Text(
                "Train with purpose. Your coaching workspace, wherever you play.",
                color = muted,
                fontSize = 15.sp,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(28.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = scheme.surface),
                border = BorderStroke(1.dp, scheme.outline.copy(alpha = 0.6f))
            ) {
                Column(Modifier.padding(22.dp)) {
                    Text("Sign in", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = scheme.onSurface)
                    Text("Use the account linked to your club.", fontSize = 13.sp, color = scheme.onSurface.copy(alpha = 0.65f))
                    Spacer(Modifier.height(18.dp))
                    when {
                        providers.isEmpty() && error.isBlank() -> Row(
                            Modifier.fillMaxWidth().padding(vertical = 12.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                            Spacer(Modifier.width(10.dp))
                            Text("Connecting…", fontSize = 13.sp, color = scheme.onSurface.copy(alpha = 0.65f))
                        }
                        providers.isNotEmpty() && enabledProviders.isEmpty() -> SignInNotice(
                            "No sign-in provider is configured. Configure an identity provider on the eCricketCoach API, then retry.",
                            isError = true
                        )
                        else -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            enabledProviders.forEach { provider ->
                                ProviderButton(provider, enabled = !signingIn) { onSignIn(provider.id) }
                            }
                        }
                    }
                    if (signingIn) {
                        Row(
                            Modifier.fillMaxWidth().padding(top = 14.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                            Spacer(Modifier.width(10.dp))
                            Text("Signing you in…", fontSize = 13.sp, color = scheme.onSurface.copy(alpha = 0.7f))
                        }
                    }
                    if (error.isNotBlank()) {
                        Spacer(Modifier.height(14.dp))
                        SignInNotice(error, isError = true)
                    }
                }
            }

            Spacer(Modifier.height(26.dp))
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                SignInFeature(Icons.Outlined.CalendarMonth, "Plan and run sessions", "Schedule drills, track attendance and review delivery.")
                SignInFeature(Icons.Outlined.Assessment, "Assess every player", "Rate skills, capture feedback and share PDF reports.")
                SignInFeature(Icons.Outlined.AutoAwesome, "AI-powered insights", "Turn video and assessments into clear next steps.")
            }
            Spacer(Modifier.height(28.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Lock, contentDescription = null, tint = muted, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(6.dp))
                Text("Secure sign-in · v${BuildConfig.VERSION_NAME}", fontSize = 12.sp, color = muted)
            }
        }
    }
}

private data class SignInProvider(val id: String, val label: String, val mark: String, val markColor: Color)

@androidx.compose.runtime.Composable
private fun ProviderButton(provider: SignInProvider, enabled: Boolean, onClick: () -> Unit) {
    val scheme = MaterialTheme.colorScheme
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth().height(54.dp),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, scheme.outline),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = scheme.background, contentColor = scheme.onSurface)
    ) {
        Box(
            Modifier.size(28.dp).clip(CircleShape).background(provider.markColor.copy(alpha = 0.14f)),
            contentAlignment = Alignment.Center
        ) {
            Text(provider.mark, color = provider.markColor, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp)
        }
        Spacer(Modifier.width(12.dp))
        Text(provider.label, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, modifier = Modifier.weight(1f))
        Icon(Icons.AutoMirrored.Outlined.ArrowForward, contentDescription = null, modifier = Modifier.size(18.dp), tint = scheme.primary)
    }
}

@androidx.compose.runtime.Composable
private fun SignInFeature(icon: ImageVector, title: String, detail: String) {
    val scheme = MaterialTheme.colorScheme
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(scheme.primary.copy(alpha = 0.14f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = scheme.primary, modifier = Modifier.size(22.dp))
        }
        Spacer(Modifier.width(14.dp))
        Column {
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = scheme.onBackground)
            Text(detail, fontSize = 12.sp, color = scheme.onBackground.copy(alpha = 0.65f))
        }
    }
}

@androidx.compose.runtime.Composable
private fun SignInNotice(message: String, isError: Boolean) {
    val tint = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(tint.copy(alpha = 0.1f)).padding(12.dp),
        verticalAlignment = Alignment.Top
    ) {
        Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = tint, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(10.dp))
        Text(message, color = tint, fontSize = 13.sp)
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
