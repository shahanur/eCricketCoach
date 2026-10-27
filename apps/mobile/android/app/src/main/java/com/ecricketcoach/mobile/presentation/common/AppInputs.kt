package com.ecricketcoach.mobile.presentation.common

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccessTime
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.FilterList
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalMinimumInteractiveComponentSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldColors
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ecricketcoach.mobile.presentation.common.theme.AppFontSize
import java.time.LocalDate
import com.ecricketcoach.mobile.presentation.common.theme.AppShapes

/** Corner shape shared by every form control. */
val AppFieldShape: Shape = AppShapes.Medium

/** Height shared by every single-line form control; matches the toolbar pill buttons (e.g. the Sort filter). */
val AppControlHeight: Dp = 40.dp

/** Border/container colours shared by every form control; follows the ambient MaterialTheme. */
@Composable
fun appFieldColors(): TextFieldColors = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = MaterialTheme.colorScheme.primary,
    unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.7f),
    focusedContainerColor = MaterialTheme.colorScheme.surface,
    unfocusedContainerColor = MaterialTheme.colorScheme.surface,
    disabledContainerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.6f)
)

/**
 * Standard text input with voice typing.
 * Single-line fields replace their value with the dictated text; multi-line fields append to it.
 * Email fields (detected from [keyboardType] or the label) convert spoken "at"/"dot" into an address.
 */
@Composable
fun AppTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String?,
    modifier: Modifier = Modifier,
    singleLine: Boolean = true,
    minLines: Int = 1,
    maxLines: Int = if (singleLine) 1 else Int.MAX_VALUE,
    enabled: Boolean = true,
    readOnly: Boolean = false,
    voice: Boolean = true,
    voicePrompt: String? = null,
    placeholder: String? = null,
    leadingIcon: ImageVector? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    maxLength: Int? = null,
    isError: Boolean = false,
    supportingText: String? = null,
    textStyle: TextStyle = MaterialTheme.typography.bodyMedium,
    shape: Shape = AppFieldShape,
    colors: TextFieldColors = appFieldColors()
) {
    val isEmail = keyboardType == KeyboardType.Email || label?.contains("email", ignoreCase = true) == true
    val limit: (String) -> String = { text -> if (maxLength != null) text.take(maxLength) else text }
    val emit: (String) -> Unit = { onValueChange(limit(it)) }
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val textColor = when {
        !enabled -> colors.disabledTextColor
        isError -> colors.errorTextColor
        focused -> colors.focusedTextColor
        else -> colors.unfocusedTextColor
    }
    AppFieldFrame(
        label = label,
        modifier = modifier,
        focused = focused,
        enabled = enabled,
        isError = isError,
        singleLine = singleLine,
        supportingText = supportingText,
        shape = shape,
        colors = colors,
        leadingIcon = leadingIcon,
        trailing = if (voice && !readOnly) {
            {
                VoiceMicButton(
                    current = value,
                    onValueChange = emit,
                    prompt = voicePrompt ?: "Speak ${(label ?: placeholder ?: "text").trimEnd('*', ' ', '\u2026').lowercase()}",
                    enabled = enabled,
                    singleLine = singleLine,
                    replace = singleLine,
                    transform = if (isEmail) ::spokenEmailAddress else { text -> text },
                    modifier = Modifier.size(34.dp)
                )
            }
        } else null
    ) {
        BasicTextField(
            value = value,
            onValueChange = emit,
            modifier = Modifier.fillMaxWidth(),
            enabled = enabled,
            readOnly = readOnly,
            singleLine = singleLine,
            minLines = minLines,
            maxLines = maxLines,
            textStyle = textStyle.copy(color = textColor),
            cursorBrush = SolidColor(if (isError) colors.errorCursorColor else colors.cursorColor),
            keyboardOptions = KeyboardOptions(keyboardType = if (isEmail) KeyboardType.Email else keyboardType),
            interactionSource = interaction,
            decorationBox = { inner ->
                Box(contentAlignment = Alignment.CenterStart) {
                    if (value.isEmpty() && placeholder != null) {
                        Text(
                            placeholder,
                            fontSize = AppFontSize.Body,
                            color = colors.unfocusedPlaceholderColor,
                            maxLines = if (singleLine) 1 else Int.MAX_VALUE,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    inner()
                }
            }
        )
    }
}

/**
 * Outlined 40dp frame shared by every form control. The label always sits on the top border
 * so the control keeps the same compact height whether it is empty or filled.
 */
@Composable
private fun AppFieldFrame(
    label: String?,
    modifier: Modifier,
    focused: Boolean,
    enabled: Boolean,
    isError: Boolean = false,
    singleLine: Boolean = true,
    supportingText: String? = null,
    shape: Shape = AppFieldShape,
    colors: TextFieldColors = appFieldColors(),
    leadingIcon: ImageVector? = null,
    leadingTint: androidx.compose.ui.graphics.Color? = null,
    trailing: (@Composable () -> Unit)? = null,
    content: @Composable () -> Unit
) {
    val borderColor = when {
        !enabled -> colors.disabledIndicatorColor
        isError -> colors.errorIndicatorColor
        focused -> colors.focusedIndicatorColor
        else -> colors.unfocusedIndicatorColor
    }
    val container = when {
        !enabled -> colors.disabledContainerColor
        focused -> colors.focusedContainerColor
        else -> colors.unfocusedContainerColor
    }
    val labelColor = when {
        !enabled -> colors.disabledLabelColor
        isError -> colors.errorLabelColor
        focused -> colors.focusedLabelColor
        else -> colors.unfocusedLabelColor
    }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Box(Modifier.fillMaxWidth().padding(top = if (label != null) 7.dp else 0.dp)) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .then(if (singleLine) Modifier.height(AppControlHeight) else Modifier.heightIn(min = AppControlHeight))
                    .background(container, shape)
                    .border(if (focused) 1.5.dp else 1.dp, borderColor, shape)
                    .padding(start = if (leadingIcon != null) 10.dp else 14.dp, end = if (trailing != null) 4.dp else 12.dp),
                verticalAlignment = if (singleLine) Alignment.CenterVertically else Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (leadingIcon != null) {
                    Icon(
                        leadingIcon,
                        contentDescription = null,
                        tint = leadingTint ?: colors.unfocusedLeadingIconColor,
                        modifier = Modifier.padding(top = if (singleLine) 0.dp else 10.dp).size(18.dp)
                    )
                }
                Box(Modifier.weight(1f).padding(vertical = if (singleLine) 0.dp else 10.dp)) { content() }
                if (trailing != null) {
                    CompositionLocalProvider(LocalMinimumInteractiveComponentSize provides 0.dp) {
                        Box(Modifier.padding(top = if (singleLine) 0.dp else 3.dp)) { trailing() }
                    }
                }
            }
            if (label != null) {
                Text(
                    label,
                    fontSize = AppFontSize.Caption,
                    lineHeight = 12.sp,
                    color = labelColor,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier
                        .offset(x = 10.dp, y = (-6).dp)
                        .background(container, AppShapes.Small)
                        .padding(horizontal = 4.dp)
                )
            }
        }
        if (supportingText != null) {
            Text(supportingText, fontSize = AppFontSize.Caption, color = if (isError) colors.errorSupportingTextColor else colors.unfocusedSupportingTextColor, modifier = Modifier.padding(start = 14.dp))
        }
    }
}

/** Numeric-only text field (no voice). */
@Composable
fun AppNumberField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    maxLength: Int? = null
) = AppTextField(
    value = value,
    onValueChange = { onValueChange(it.filter(Char::isDigit)) },
    label = label,
    modifier = modifier,
    enabled = enabled,
    voice = false,
    keyboardType = KeyboardType.Number,
    maxLength = maxLength
)

/** Search box with a leading search icon, placeholder and voice search. */
@Composable
fun AppSearchField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    voicePrompt: String? = null
) = AppTextField(
    value = value,
    onValueChange = onValueChange,
    label = null,
    placeholder = placeholder,
    leadingIcon = Icons.Outlined.Search,
    modifier = modifier,
    enabled = enabled,
    voicePrompt = voicePrompt ?: "Say what to search for"
)

/** Read-only field that looks like [AppTextField] but opens something (a picker or menu) when tapped. */
@Composable
private fun AppPickerField(
    value: String,
    label: String?,
    trailingIcon: ImageVector,
    modifier: Modifier,
    enabled: Boolean,
    placeholder: String? = null,
    leadingIcon: ImageVector? = null,
    onOpen: () -> Unit
) {
    val colors = appFieldColors()
    Box(modifier) {
        AppFieldFrame(
            label = label,
            modifier = Modifier.fillMaxWidth(),
            focused = false,
            enabled = enabled,
            colors = colors,
            leadingIcon = leadingIcon,
            leadingTint = MaterialTheme.colorScheme.primary,
            trailing = {
                Icon(
                    trailingIcon,
                    contentDescription = null,
                    tint = if (enabled) colors.unfocusedTrailingIconColor else colors.disabledTrailingIconColor,
                    modifier = Modifier.padding(end = 6.dp).size(20.dp)
                )
            }
        ) {
            Text(
                value.ifEmpty { placeholder.orEmpty() },
                fontSize = AppFontSize.Body,
                color = when {
                    !enabled -> colors.disabledTextColor
                    value.isEmpty() -> colors.unfocusedPlaceholderColor
                    else -> colors.unfocusedTextColor
                },
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        if (enabled) {
            Box(
                Modifier
                    .matchParentSize()
                    .clip(AppFieldShape)
                    .clickable(indication = null, interactionSource = remember { MutableInteractionSource() }, onClick = onOpen)
            )
        }
    }
}

/** Date input that opens the native date picker. Value format: ISO "YYYY-MM-DD". */
@Composable
fun AppDateField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    val context = LocalContext.current
    AppPickerField(value, label, Icons.Outlined.CalendarMonth, modifier, enabled) {
        val initial = runCatching { LocalDate.parse(value) }.getOrDefault(LocalDate.now())
        android.app.DatePickerDialog(
            context,
            { _, year, month, day -> onValueChange(LocalDate.of(year, month + 1, day).toString()) },
            initial.year, initial.monthValue - 1, initial.dayOfMonth
        ).show()
    }
}

/** Time input that opens the native 24h time picker. Value format: "HH:mm". */
@Composable
fun AppTimeField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    val context = LocalContext.current
    AppPickerField(value, label, Icons.Outlined.AccessTime, modifier, enabled) {
        val parts = value.split(":").mapNotNull(String::toIntOrNull)
        android.app.TimePickerDialog(
            context,
            { _, hour, minute -> onValueChange("%02d:%02d".format(hour, minute)) },
            parts.getOrNull(0) ?: 9, parts.getOrNull(1) ?: 0, true
        ).show()
    }
}

/**
 * Form dropdown: an outlined read-only field showing the selected option, opening a menu of [options].
 * The menu matches the field width.
 */
@Composable
fun <T> AppDropdown(
    label: String?,
    options: List<T>,
    selected: T?,
    onSelected: (T) -> Unit,
    modifier: Modifier = Modifier,
    optionLabel: (T) -> String = { it.toString() },
    placeholder: String = "Select…",
    leadingIcon: ImageVector? = null,
    enabled: Boolean = true
) {
    var expanded by remember { mutableStateOf(false) }
    var widthPx by remember { mutableIntStateOf(0) }
    val density = LocalDensity.current
    Box(modifier.onSizeChanged { widthPx = it.width }) {
        AppPickerField(
            value = selected?.let(optionLabel).orEmpty(),
            label = label,
            trailingIcon = Icons.Outlined.ExpandMore,
            modifier = Modifier.fillMaxWidth(),
            enabled = enabled,
            placeholder = placeholder,
            leadingIcon = leadingIcon
        ) { expanded = true }
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = if (widthPx > 0) Modifier.width(with(density) { widthPx.toDp() }) else Modifier
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(optionLabel(option), fontSize = AppFontSize.Body) },
                    onClick = { onSelected(option); expanded = false }
                )
            }
        }
    }
}

/** [AppDropdown] for key/label pairs; [selectedKey] is matched against the pair's first value. */
@Composable
fun AppDropdown(
    label: String?,
    options: List<Pair<String, String>>,
    selectedKey: String?,
    onSelected: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Select…",
    leadingIcon: ImageVector? = null,
    enabled: Boolean = true
) = AppDropdown(
    label = label,
    options = options,
    selected = options.firstOrNull { it.first == selectedKey },
    onSelected = { onSelected(it.first) },
    modifier = modifier,
    optionLabel = { it.second },
    placeholder = placeholder,
    leadingIcon = leadingIcon,
    enabled = enabled
)

/** Compact "Label: value" pill for filter/sort toolbars. */
@Composable
fun AppFilterDropdown(
    label: String,
    options: List<Pair<String, String>>,
    selectedKey: String,
    onSelected: (String) -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector = Icons.Outlined.FilterList
) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier) {
        OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth().height(AppControlHeight), shape = AppShapes.Large) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
            Text(
                "  $label: ${options.firstOrNull { it.first == selectedKey }?.second ?: selectedKey}",
                modifier = Modifier.weight(1f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                fontSize = AppFontSize.Small
            )
            Icon(Icons.Outlined.ExpandMore, contentDescription = null, modifier = Modifier.size(18.dp))
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { (key, text) ->
                DropdownMenuItem(text = { Text(text, fontSize = AppFontSize.Body) }, onClick = { onSelected(key); expanded = false })
            }
        }
    }
}
