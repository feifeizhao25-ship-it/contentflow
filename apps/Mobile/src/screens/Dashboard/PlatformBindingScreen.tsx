import {ChevronLeft, Link, Check, X} from 'lucide-react-native';
import {Theme} from '../../styles/theme';
import apiClient from '../../services/api-client';
import {IS_CN} from '../../config/version';
const PLATFORMS = IS_CN ? CN_PLATFORMS : INT_PLATFORMS;
                const primaryPlatforms = PLATFORMS;
                return (
                  <>
                    {primaryPlatforms.length > 0 && (
                      <>
                        <Text style={styles.platformSectionTitle}>
                          {IS_CN ? '国内平台' : 'Global Platforms'}
                        </Text>
                        </View>
                      </>
                    )}
                  </>
                );
              })()}