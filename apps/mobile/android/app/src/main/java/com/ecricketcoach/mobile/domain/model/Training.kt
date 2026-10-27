package com.ecricketcoach.mobile.domain.model

data class Drill(
    val id: String,
    val title: String,
    val discipline: String,
    val skillSet: String,
    val durationMinutes: Int,
    val instructions: String,
    val imageUrl: String? = null,
    val contextType: String = "GROUP",
    val source: String = "SYSTEM_PREDEFINED"
)

data class TrainingTemplate(
    val id: String,
    val title: String,
    val focus: String,
    val durationMinutes: Int,
    val disciplines: List<String>,
    val safety: List<String> = emptyList(),
    val drillIds: List<String> = emptyList()
)
