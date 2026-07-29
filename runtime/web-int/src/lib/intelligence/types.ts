  getTimeRecommendations(platform: Platform): TimeRecommendation {
    const recommendations: Record<Platform, TimeRecommendation> = {
      tiktok: {
        platform: 'tiktok' as Platform,
        recommended_times: ['12:00-14:00', '18:00-21:00'],
      twitter: {
        platform: 'twitter' as Platform,
        recommended_times: ['09:00-11:00', '14:00-16:00', '18:00-20:00'],
        best_day: 'Tuesday',
        best_time_range: '09:00-11:00',
      },
      x: {
        platform: 'x' as Platform,
        recommended_times: ['09:00-11:00', '14:00-16:00', '18:00-20:00'],
        best_day: 'Tuesday',
        best_time_range: '09:00-11:00',
      },
      linkedin: {
        platform: 'linkedin' as Platform,
        recommended_times: ['08:00-10:00', '12:00-13:00', '17:00-18:00'],
        best_day: 'Tuesday',
        best_time_range: '08:00-10:00',
      },
      reddit: {
        platform: 'reddit' as Platform,
        recommended_times: ['07:00-09:00', '12:00-14:00', '19:00-22:00'],
        best_day: 'Thursday',
        best_time_range: '19:00-22:00',
      },
      facebook: {
        platform: 'facebook' as Platform,
        recommended_times: ['09:00-11:00', '13:00-15:00', '18:00-20:00'],
        best_day: 'Wednesday',
        best_time_range: '13:00-15:00',
      },
    };

    return recommendations[platform] || recommendations.tiktok;
  }
