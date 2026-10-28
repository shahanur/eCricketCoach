package com.ecricketcoach.mobile.presentation.common

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.ecricketcoach.mobile.presentation.common.theme.AppFontSize
import com.ecricketcoach.mobile.presentation.common.theme.AppShapes

/** Corner shape shared by every panel. */
val AppPanelShape: Shape = AppShapes.Large

/** Default inner padding of a panel. */
val AppPanelPadding: Dp = 14.dp

/** Background treatment of an [AppPanel]. */
enum class AppPanelTone {
    /** Plain surface – the default for content panels and list items. */
    Default,
    /** Light primary tint – for highlighted/insight panels. */
    Accent,
    /** Subtle neutral tint – for nested panels inside another panel. */
    Muted
}

@Composable
private fun AppPanelTone.containerColor(): Color = when (this) {
    AppPanelTone.Default -> MaterialTheme.colorScheme.surface
    AppPanelTone.Accent -> MaterialTheme.colorScheme.primary.copy(alpha = 0.07f)
    AppPanelTone.Muted -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
}

/**
 * Standard content panel: a rounded card with consistent padding and an optional header row
 * (icon + [title] + trailing [actions]). Content is laid out in a column spaced by [spacing].
 */
@Composable
fun AppPanel(
    modifier: Modifier = Modifier,
    title: String? = null,
    icon: ImageVector? = null,
    tone: AppPanelTone = AppPanelTone.Default,
    containerColor: Color? = null,
    border: BorderStroke? = null,
    contentPadding: PaddingValues = PaddingValues(AppPanelPadding),
    spacing: Dp = 8.dp,
    fillHeight: Boolean = false,
    onClick: (() -> Unit)? = null,
    actions: (@Composable RowScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    val colors = CardDefaults.cardColors(containerColor = containerColor ?: tone.containerColor())
    val body: @Composable ColumnScope.() -> Unit = {
        Column(
            Modifier
                .fillMaxWidth()
                .then(if (fillHeight) Modifier.fillMaxHeight() else Modifier)
                .padding(contentPadding),
            verticalArrangement = Arrangement.spacedBy(spacing)
        ) {
            if (title != null || actions != null) {
                AppPanelHeader(title.orEmpty(), icon, actions)
            }
            content()
        }
    }
    if (onClick != null) {
        Card(onClick = onClick, modifier = modifier, shape = AppPanelShape, colors = colors, border = border, content = body)
    } else {
        Card(modifier = modifier, shape = AppPanelShape, colors = colors, border = border, content = body)
    }
}

/** Header row used by [AppPanel]; also usable on its own for sub-sections inside a panel. */
@Composable
fun AppPanelHeader(
    title: String,
    icon: ImageVector? = null,
    actions: (@Composable RowScope.() -> Unit)? = null
) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 28.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(end = 8.dp).size(19.dp))
        }
        Text(
            title,
            fontSize = AppFontSize.BodyLarge,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )
        actions?.invoke(this)
    }
}
