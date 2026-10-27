package com.ecricketcoach.mobile.presentation.common.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

internal val Indigo = Color(0xFFB6A3FF)
internal val Green = Color(0xFF58C288)
internal val Night = Color(0xFF090D16)
internal val Panel = Color(0xFF151B27)
internal val Orchid = Color(0xFF7C5CFA)
internal val Blossom = Color(0xFFF3F0FC)

private val DarkColors = darkColorScheme(
    primary = Indigo,
    onPrimary = Color(0xFF101126),
    secondary = Color(0xFFFF93C0),
    tertiary = Color(0xFF57E6B0),
    background = Night,
    surface = Panel,
    surfaceVariant = Color(0xFF20283A),
    outline = Color(0xFF3A465D)
)

private val LightColors = lightColorScheme(
    primary = Orchid,
    onPrimary = Color.White,
    secondary = Color(0xFFFF6FA8),
    tertiary = Color(0xFF1FB683),
    background = Blossom,
    surface = Color.White,
    surfaceVariant = Color(0xFFEDE8FB),
    outline = Color(0xFFD9D2F0)
)

/** Club workspace palette (Ekota styled pages). */
private val WorkspaceLightColors = lightColorScheme(
    primary = Color(0xFF5134D8),
    onPrimary = Color.White,
    secondary = Color(0xFF2589F3),
    background = Color(0xFFF7F8FD),
    surface = Color.White,
    surfaceVariant = Color(0xFFF0EEFF),
    onSurface = Color(0xFF151B35),
    onSurfaceVariant = Color(0xFF5B6782),
    outline = Color(0xFFDDE2F1),
    outlineVariant = Color(0xFFE8EAF3),
    error = Color(0xFFD94A66)
)

private val WorkspaceDarkColors = darkColorScheme(
    primary = Color(0xFFA594FF),
    onPrimary = Color(0xFF14102E),
    secondary = Color(0xFF6BB2FF),
    background = Color(0xFF0B1020),
    onBackground = Color(0xFFE6E9F5),
    surface = Color(0xFF161D31),
    onSurface = Color(0xFFE6E9F5),
    surfaceVariant = Color(0xFF232B45),
    onSurfaceVariant = Color(0xFFA9B3CF),
    outline = Color(0xFF34405F),
    outlineVariant = Color(0xFF2A3350),
    error = Color(0xFFFF7A93)
)

private val LiveSessionLightColors = WorkspaceLightColors.copy(
    background = Color(0xFFF3F5FD),
    surface = Color.White.copy(alpha = 0.8f)
)

/** Whether the app is currently in dark mode (toggled from the header sun/moon button). */
val LocalIsDarkTheme = staticCompositionLocalOf { false }

/** Colours for club workspace pages; follows the current light/dark mode. */
val WorkspaceColors: ColorScheme
    @Composable @ReadOnlyComposable
    get() = if (LocalIsDarkTheme.current) WorkspaceDarkColors else WorkspaceLightColors

/** Colours for the live session screens. Kept light-only: those screens hard-code light surfaces. */
val LiveSessionColors: ColorScheme
    @Composable @ReadOnlyComposable
    get() = LiveSessionLightColors

/** Date/arrow chip colours on workspace cards. */
val WorkspaceChipBackground: Color
    @Composable @ReadOnlyComposable
    get() = if (LocalIsDarkTheme.current) Color(0xFF26304F) else Color(0xFFE8EEFF)

val WorkspaceChipContent: Color
    @Composable @ReadOnlyComposable
    get() = if (LocalIsDarkTheme.current) Color(0xFF9DB6FF) else Color(0xFF3159D8)

@Composable
fun ECricketCoachTheme(isDark: Boolean, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalIsDarkTheme provides isDark) {
        MaterialTheme(colorScheme = if (isDark) DarkColors else LightColors, content = content)
    }
}
