  const monthLabel = IS_INTL
    ? currentMonth.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
      })
    : `${currentMonth.getFullYear()}年 ${currentMonth.getMonth() + 1}月`;
  const selectedDateLabel = IS_INTL
    ? `${selectedDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
      })} Schedule`
    : `${selectedDate.getMonth() + 1}${t('月_kco')}${selectedDate.getDate()}${t(
        '日_排期_cv62',
      )}`;
        {/* Events Section */}
        <View style={styles.eventsSection}>
          <Text style={styles.sectionTitle}>{selectedDateLabel}</Text>
