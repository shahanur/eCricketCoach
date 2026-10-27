package com.ecricketcoach.mobile.presentation.common.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
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

@Composable
fun ECricketCoachTheme(isDark: Boolean, content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (isDark) DarkColors else LightColors, content = content)
}
