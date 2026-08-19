import {Theme} from '../../styles/theme';
import {SUPPORTED_PLATFORMS} from '../../config/version';
const platformsList = SUPPORTED_PLATFORMS.map(platform => ({
  id: platform.id,
  name: platform.name,
}));
const defaultPlatformIds = platformsList.slice(0, 2).map(platform => platform.id);
const toApiPlatformId = (platformId: string) =>
  platformId === 'xhs' ? 'xiaohongshu' : platformId;
  const [niche, setNiche] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] =
    useState<string[]>(defaultPlatformIds);
          setSelectedPlatforms(
            data.platforms ||
              (data.platform ? [data.platform] : [defaultPlatformIds[0]]),
          );
      const platforms = selectedPlatforms.map(toApiPlatformId);
        toApiPlatformId(selectedPlatforms[0] || defaultPlatformIds[0]);
        toApiPlatformId(selectedPlatforms[0] || defaultPlatformIds[0]);
        toApiPlatformId(selectedPlatforms[0] || defaultPlatformIds[0]);
