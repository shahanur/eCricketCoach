package com.ecricketcoach.mobile.presentation.common.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

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

/** Club workspace palette: neutral slate surfaces with a single indigo accent. */
private val WorkspaceLightColors = lightColorScheme(
    primary = Color(0xFF4F46E5),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFEEF0FF),
    onPrimaryContainer = Color(0xFF3730A3),
    secondary = Color(0xFF4F46E5),
    background = Color(0xFFF6F7F9),
    onBackground = Color(0xFF0F172A),
    surface = Color.White,
    surfaceVariant = Color(0xFFF1F3F6),
    onSurface = Color(0xFF0F172A),
    onSurfaceVariant = Color(0xFF64748B),
    outline = Color(0xFFE2E6EC),
    outlineVariant = Color(0xFFE9ECF1),
    error = Color(0xFFDC2626)
)

private val WorkspaceDarkColors = darkColorScheme(
    primary = Color(0xFF8B93FF),
    onPrimary = Color(0xFF14123A),
    primaryContainer = Color(0xFF23264A),
    onPrimaryContainer = Color(0xFFC7CBFF),
    secondary = Color(0xFF8B93FF),
    background = Color(0xFF0D1117),
    onBackground = Color(0xFFE6E8EC),
    surface = Color(0xFF151A22),
    onSurface = Color(0xFFE6E8EC),
    surfaceVariant = Color(0xFF1E242E),
    onSurfaceVariant = Color(0xFF98A2B3),
    outline = Color(0xFF2A313C),
    outlineVariant = Color(0xFF232933),
    error = Color(0xFFF87171)
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
    get() = if (LocalIsDarkTheme.current) Color(0xFF23264A) else Color(0xFFEEF0FF)

val WorkspaceChipContent: Color
    @Composable @ReadOnlyComposable
    get() = if (LocalIsDarkTheme.current) Color(0xFFC7CBFF) else Color(0xFF4338CA)

/**
 * App-wide font size scale. Use these instead of literal `.sp` values so text sizes stay consistent
 * and can be tuned in one place.
 */
object AppFontSize {
    /** Tiny meta text: badges, timestamps. */
    val Micro = 10.sp
    /** Captions, field labels, secondary meta. */
    val Caption = 11.sp
    /** Small/secondary body text, chips. */
    val Small = 12.sp
    /** Normal body text. */
    val Body = 14.sp
    /** Emphasised body text, list item titles. */
    val BodyLarge = 16.sp
    /** Card and section titles. */
    val Title = 18.sp
    /** Dialog and panel titles. */
    val TitleLarge = 20.sp
    /** Page sub-headers and detail headers. */
    val Headline = 24.sp
    /** Large stat numbers. */
    val HeadlineLarge = 28.sp
    /** Screen headers. */
    val Display = 32.sp
}

/** Material typography mapped onto [AppFontSize] so default `Text` styles follow the same scale. */
val AppTypography = Typography().let { base ->
    base.copy(
        headlineLarge = base.headlineLarge.copy(fontSize = AppFontSize.Display, lineHeight = 40.sp, fontWeight = FontWeight.ExtraBold),
        headlineMedium = base.headlineMedium.copy(fontSize = AppFontSize.HeadlineLarge, lineHeight = 36.sp),
        headlineSmall = base.headlineSmall.copy(fontSize = AppFontSize.Headline, lineHeight = 32.sp),
        titleLarge = base.titleLarge.copy(fontSize = AppFontSize.TitleLarge, lineHeight = 28.sp),
        titleMedium = base.titleMedium.copy(fontSize = AppFontSize.Title, lineHeight = 24.sp),
        titleSmall = base.titleSmall.copy(fontSize = AppFontSize.BodyLarge, lineHeight = 22.sp),
        bodyLarge = base.bodyLarge.copy(fontSize = AppFontSize.BodyLarge, lineHeight = 24.sp),
        bodyMedium = base.bodyMedium.copy(fontSize = AppFontSize.Body, lineHeight = 20.sp),
        bodySmall = base.bodySmall.copy(fontSize = AppFontSize.Small, lineHeight = 16.sp),
        labelLarge = base.labelLarge.copy(fontSize = AppFontSize.Body, lineHeight = 20.sp),
        labelMedium = base.labelMedium.copy(fontSize = AppFontSize.Small, lineHeight = 16.sp),
        labelSmall = base.labelSmall.copy(fontSize = AppFontSize.Caption, lineHeight = 16.sp)
    )
}

/**
 * App-wide corner radii. Kept deliberately small for a modern, flat look; change the values here
 * to restyle every control, chip, panel and dialog at once.
 */
object AppCorner {
    /** Chips, badges, small tiles and indicators. */
    val Small = 4.dp
    /** Inputs, dropdowns and buttons. */
    val Medium = 6.dp
    /** Panels, cards, sheets and dialogs. */
    val Large = 8.dp
}

object AppShapes {
    val Small: Shape = RoundedCornerShape(AppCorner.Small)
    val Medium: Shape = RoundedCornerShape(AppCorner.Medium)
    val Large: Shape = RoundedCornerShape(AppCorner.Large)
    /** Shape for every Material button (Material 3 buttons default to full pills). */
    val Button: Shape = Medium
}

/** Material shape scale mapped onto [AppCorner] so default components (menus, dialogs, cards) follow it. */
val AppMaterialShapes = Shapes(
    extraSmall = RoundedCornerShape(AppCorner.Small),
    small = RoundedCornerShape(AppCorner.Small),
    medium = RoundedCornerShape(AppCorner.Medium),
    large = RoundedCornerShape(AppCorner.Large),
    extraLarge = RoundedCornerShape(AppCorner.Large)
)

@Composable
fun ECricketCoachTheme(isDark: Boolean, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalIsDarkTheme provides isDark) {
        MaterialTheme(colorScheme = if (isDark) DarkColors else LightColors, typography = AppTypography, shapes = AppMaterialShapes, content = content)
    }
}
