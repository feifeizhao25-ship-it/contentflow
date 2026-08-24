        <SkeletonPulse style={styles.skeletonTitle} />
        <SkeletonPulse style={styles.skeletonAction} />
      <SkeletonPulse style={[styles.sectionCard, styles.skeletonChartLarge]} />
      <SkeletonPulse style={[styles.sectionCard, styles.skeletonChartSmall]} />
  sectionCard: {
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radius.lg,
    ...Theme.shadows.sm,
  },
  skeletonTitle: {width: 120, height: 28, borderRadius: Theme.radius.md},
  skeletonAction: {width: 80, height: 32, borderRadius: Theme.radius.full},
  skeletonChartLarge: {height: 200},
  skeletonChartSmall: {height: 180, marginTop: Theme.spacing.lg},
