package com.ecricketcoach.mobile.presentation.auth

import com.ecricketcoach.mobile.domain.model.*
import com.ecricketcoach.mobile.BuildConfig
import com.ecricketcoach.mobile.R
import com.ecricketcoach.mobile.presentation.common.theme.*
import android.util.Log
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
import androidx.compose.ui.text.TextStyle
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
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@androidx.compose.runtime.Composable
internal fun SignInScreen(
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
        SignInProvider("google", "Continue with Google", "G", Color(0xFF4285F4), R.drawable.ic_google_logo),
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
            Text(
                "eCricketCoach",
                fontSize = AppFontSize.HeadlineLarge,
                fontWeight = FontWeight.ExtraBold,
                style = TextStyle(brush = Brush.linearGradient(listOf(scheme.onBackground, scheme.primary, Orchid)))
            )
            Spacer(Modifier.height(6.dp))
            Text(
                "Train with purpose. Your coaching workspace, wherever you play.",
                color = muted,
                fontSize = AppFontSize.Body,
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
                    Text("Sign in", fontSize = AppFontSize.TitleLarge, fontWeight = FontWeight.Bold, color = scheme.onSurface)
                    Text("Use the account linked to your club.", fontSize = AppFontSize.Small, color = scheme.onSurface.copy(alpha = 0.65f))
                    Spacer(Modifier.height(18.dp))
                    when {
                        providers.isEmpty() && error.isBlank() -> Row(
                            Modifier.fillMaxWidth().padding(vertical = 12.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                            Spacer(Modifier.width(10.dp))
                            Text("Connecting…", fontSize = AppFontSize.Small, color = scheme.onSurface.copy(alpha = 0.65f))
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
                            Text("Signing you in…", fontSize = AppFontSize.Small, color = scheme.onSurface.copy(alpha = 0.7f))
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
                Text("Secure sign-in · v${BuildConfig.VERSION_NAME}", fontSize = AppFontSize.Small, color = muted)
            }
        }
    }
}

private data class SignInProvider(val id: String, val label: String, val mark: String, val markColor: Color, val logoRes: Int? = null)

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
        if (provider.logoRes != null) {
            Box(
                Modifier.size(28.dp).clip(CircleShape).background(Color.White),
                contentAlignment = Alignment.Center
            ) {
                Image(painterResource(provider.logoRes), contentDescription = null, modifier = Modifier.size(18.dp))
            }
        } else {
            Box(
                Modifier.size(28.dp).clip(CircleShape).background(provider.markColor.copy(alpha = 0.14f)),
                contentAlignment = Alignment.Center
            ) {
                Text(provider.mark, color = provider.markColor, fontWeight = FontWeight.ExtraBold, fontSize = AppFontSize.Body)
            }
        }
        Spacer(Modifier.width(12.dp))
        Text(provider.label, fontWeight = FontWeight.SemiBold, fontSize = AppFontSize.Body, modifier = Modifier.weight(1f))
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
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = AppFontSize.Body, color = scheme.onBackground)
            Text(detail, fontSize = AppFontSize.Small, color = scheme.onBackground.copy(alpha = 0.65f))
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
        Text(message, color = tint, fontSize = AppFontSize.Small)
    }
}
