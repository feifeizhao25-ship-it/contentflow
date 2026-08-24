import {Theme} from '../styles/theme';
import apiClient from '../services/api-client';
import {SUPPORTED_PLATFORMS} from '../config/version';
const platforms = SUPPORTED_PLATFORMS.map(platform => ({
  key: platform.id,
  label: platform.name,
}));