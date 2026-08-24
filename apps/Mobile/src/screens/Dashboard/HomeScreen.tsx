    <View style={styles.skeletonBody}>
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
  skeletonLine: {
    height: 14,
    borderRadius: 4,
    backgroundColor: Theme.colors.gray[200],
  },
  skeletonBody: {
    flex: 1,
    marginLeft: 12,
  },
  skeletonLineShort: {
    width: '60%',
    marginTop: 8,
  },
