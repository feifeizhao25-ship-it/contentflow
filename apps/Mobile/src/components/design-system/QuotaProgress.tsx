import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Theme} from '../../styles/theme';
import {IS_CN} from '../../config/version';
  const displayTotal = isUnlimited
    ? IS_CN
      ? '无限制'
      : 'Unlimited'
    : `${total}${unit}`;
  const message = isUnlimited
    ? IS_CN
      ? `已使用 ${displayUsed}`
      : `Used ${displayUsed}`
    : ratio >= criticalThreshold
    ? IS_CN
      ? `快用完了，${displayUsed}/${displayTotal}`
      : `Almost used up: ${displayUsed}/${displayTotal}`
    : ratio >= warningThreshold
    ? IS_CN
      ? `用得有点快，${displayUsed}/${displayTotal}`
      : `Usage is rising: ${displayUsed}/${displayTotal}`
    : IS_CN
    ? `已用 ${displayUsed} / ${displayTotal}`
    : `Used ${displayUsed} / ${displayTotal}`;