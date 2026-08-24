import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Theme} from '../../styles/theme';
import {IS_CN} from '../../config/version';
const statusConfig: Record<
  HealthStatus,
  {label: string; labelEn: string; color: string; bg: string}
> = {
  good: {
    label: '健康',
    labelEn: 'Healthy',
    color: Theme.colors.success,
    bg: '#ECFDF5',
  },
  warning: {
    label: '需关注',
    labelEn: 'Needs attention',
    color: Theme.colors.warning,
    bg: '#FFFBEB',
  },
  critical: {
    label: '异常',
    labelEn: 'Critical',
    color: Theme.colors.error,
    bg: '#FEF2F2',
  },
          <Text style={[styles.status, {color: cfg.color}]}>
            {IS_CN ? cfg.label : cfg.labelEn}
          </Text>