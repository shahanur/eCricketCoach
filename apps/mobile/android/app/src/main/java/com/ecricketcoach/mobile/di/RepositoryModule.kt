package com.ecricketcoach.mobile.di

import com.ecricketcoach.mobile.data.repository.AnalysisRepositoryImpl
import com.ecricketcoach.mobile.data.repository.AuthRepositoryImpl
import com.ecricketcoach.mobile.data.repository.ClubRepositoryImpl
import com.ecricketcoach.mobile.data.repository.OfflineMutationRepositoryImpl
import com.ecricketcoach.mobile.data.repository.TrainingContentRepositoryImpl
import com.ecricketcoach.mobile.domain.repository.AnalysisRepository
import com.ecricketcoach.mobile.domain.repository.AuthRepository
import com.ecricketcoach.mobile.domain.repository.ClubRepository
import com.ecricketcoach.mobile.domain.repository.OfflineMutationRepository
import com.ecricketcoach.mobile.domain.repository.TrainingContentRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds abstract fun bindAuthRepository(impl: AuthRepositoryImpl): AuthRepository
    @Binds abstract fun bindTrainingContentRepository(impl: TrainingContentRepositoryImpl): TrainingContentRepository
    @Binds abstract fun bindClubRepository(impl: ClubRepositoryImpl): ClubRepository
    @Binds abstract fun bindAnalysisRepository(impl: AnalysisRepositoryImpl): AnalysisRepository
    @Binds abstract fun bindOfflineMutationRepository(impl: OfflineMutationRepositoryImpl): OfflineMutationRepository
}
