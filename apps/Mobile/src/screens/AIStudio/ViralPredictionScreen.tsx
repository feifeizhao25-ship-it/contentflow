import {TrendingUp, Flame, Target} from 'lucide-react-native';
import {Theme} from '../../styles/theme';
import apiClient from '../../services/api-client';
import {IS_CN, SUPPORTED_PLATFORMS} from '../../config/version';
  const [platform, setPlatform] = useState(SUPPORTED_PLATFORMS[0]?.id || 'tiktok');
  const platforms = SUPPORTED_PLATFORMS.slice(0, 6).map(item => ({
    key: item.id,
    label: item.name,
  }));
      const level =
        score >= 85
          ? IS_CN
            ? '🔥 爆款潜力极高'
            : '🔥 Very strong potential'
        : score >= 70
          ? IS_CN
            ? '⭐ 爆款潜力较高'
            : '⭐ Strong potential'
        : score >= 55
          ? IS_CN
            ? '📈 有潜力'
            : '📈 Some potential'
          : IS_CN
          ? '⚠️ 潜力一般'
          : '⚠️ Needs work';
        score: 60,
        level: IS_CN ? '📈 有潜力' : '📈 Some potential',
