package com.ecricketcoach.mobile.presentation.common

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalTime

/**
 * Shared screen header: optional greeting with theme toggle and sign-out actions,
 * a title slot, the club badge and a bottom divider. Colours come from the ambient MaterialTheme.
 */
@Composable
fun AppHeader(
    isDark: Boolean,
    onToggleTheme: () -> Unit,
    onSignOut: () -> Unit,
    clubName: String,
    modifier: Modifier = Modifier,
    greeting: String? = null,
    title: @Composable ColumnScope.() -> Unit
) {
    val scheme = MaterialTheme.colorScheme
    Column(modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                if (greeting != null) {
                    Text(greeting, color = scheme.onSurface.copy(alpha = 0.72f), fontSize = 17.sp, modifier = Modifier.weight(1f))
                } else {
                    Spacer(Modifier.weight(1f))
                }
                ThemeToggleButton(isDark, onToggleTheme)
                IconButton(onClick = onSignOut, modifier = Modifier.size(38.dp)) {
                    Icon(Icons.AutoMirrored.Outlined.Logout, contentDescription = "Sign out", tint = scheme.onSurface)
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f), content = title)
                ClubBadge(clubName, Modifier.padding(start = 8.dp))
            }
        }
        HorizontalDivider(color = scheme.outline.copy(alpha = 0.8f))
    }
}

@Composable
fun ThemeToggleButton(isDark: Boolean, onToggleTheme: () -> Unit, modifier: Modifier = Modifier) {
    IconButton(onClick = onToggleTheme, modifier = modifier.size(38.dp)) {
        Icon(
            if (isDark) Icons.Outlined.LightMode else Icons.Outlined.DarkMode,
            contentDescription = if (isDark) "Switch to light theme" else "Switch to dark theme",
            tint = MaterialTheme.colorScheme.primary
        )
    }
}

@Composable
fun ClubBadge(clubName: String, modifier: Modifier = Modifier) {
    val scheme = MaterialTheme.colorScheme
    Surface(
        shape = RoundedCornerShape(24.dp),
        color = scheme.surface,
        border = BorderStroke(1.dp, scheme.primary.copy(alpha = 0.18f)),
        modifier = modifier
    ) {
        Row(Modifier.padding(horizontal = 11.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.Groups, contentDescription = null, tint = scheme.primary, modifier = Modifier.size(18.dp))
            Text(clubName, color = scheme.onSurface, fontWeight = FontWeight.Bold, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(start = 6.dp))
            Icon(Icons.Outlined.ExpandMore, contentDescription = null, tint = scheme.onSurface, modifier = Modifier.padding(start = 4.dp).size(17.dp))
        }
    }
}

/** Large name title with a wave, used on landing screens. */
@Composable
fun HeaderGreetingTitle(name: String, tagline: String) {
    val scheme = MaterialTheme.colorScheme
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(name, color = scheme.onSurface, fontSize = 32.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(" 👋", fontSize = 24.sp)
    }
    Text(tagline, color = scheme.onSurface.copy(alpha = 0.72f), fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
}

/** Icon + page title with a one-line description. */
@Composable
fun HeaderPageTitle(icon: ImageVector, title: String, description: String) {
    val scheme = MaterialTheme.colorScheme
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(icon, contentDescription = null, tint = scheme.primary, modifier = Modifier.size(29.dp))
            Text(title, color = scheme.onSurface, fontSize = 32.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Text(description, color = scheme.onSurface.copy(alpha = 0.72f), fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** Circular back button used by detail headers. */
@Composable
fun HeaderBackButton(onClick: () -> Unit, contentDescription: String = "Back") {
    val scheme = MaterialTheme.colorScheme
    Surface(
        shape = CircleShape,
        color = scheme.surface,
        border = BorderStroke(1.dp, scheme.primary.copy(alpha = 0.18f)),
        modifier = Modifier.size(44.dp)
    ) {
        Box(contentAlignment = Alignment.Center) {
            IconButton(onClick = onClick) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = contentDescription, tint = scheme.primary, modifier = Modifier.size(24.dp))
            }
        }
    }
}

fun timeOfDayGreeting(hour: Int = LocalTime.now().hour): String = when (hour) {
    in 5..11 -> "Good morning,"
    in 12..16 -> "Good afternoon,"
    else -> "Good evening,"
}
