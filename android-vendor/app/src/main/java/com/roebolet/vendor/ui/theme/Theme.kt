package com.roebolet.vendor.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = RoeGold,
    onPrimary = RoeBackground,
    secondary = RoePurple,
    onSecondary = RoeTextLight,
    background = RoeBackground,
    onBackground = RoeTextLight,
    surface = RoeSurface,
    onSurface = RoeTextLight,
    error = RoeDanger,
)

@Composable
fun RoeBoletTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
