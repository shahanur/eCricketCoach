package com.ecricketcoach.mobile.di

import android.content.Context
import com.ecricketcoach.mobile.BuildConfig
import com.ecricketcoach.mobile.data.api.CoachApi
import com.ecricketcoach.mobile.data.datastore.AuthStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @Singleton
    fun provideCoachApi(): CoachApi = CoachApi(BuildConfig.API_BASE_URL, BuildConfig.OAUTH_ORIGIN)

    @Provides
    @Singleton
    fun provideAuthStore(@ApplicationContext context: Context): AuthStore = AuthStore(context)
}
