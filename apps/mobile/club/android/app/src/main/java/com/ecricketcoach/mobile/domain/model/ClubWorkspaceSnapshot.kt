package com.ecricketcoach.mobile.domain.model

/** Everything the club workspace needs to render, loaded in a single parallel refresh. */
data class ClubWorkspaceSnapshot(
    val members: List<ClubMember>,
    val squads: List<ClubSquad>,
    val sessions: List<ClubTrainingSession>,
    val drills: List<Drill>,
    val catalogueDrills: List<Drill>,
    val certificates: List<ClubCertificate>,
    val logo: String?
)
