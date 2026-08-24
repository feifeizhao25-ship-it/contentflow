import apiClient, {uploadFile} from '../../services/api-client';
import {IS_CN} from '../../config/version';
  const handlePreview = (asset: AssetItem) => {
    Alert.alert(
      asset.name,
      IS_CN
        ? `类型: ${asset.type}\n大小: ${asset.size}\n上传日期: ${asset.date}`
        : `Type: ${asset.type}\nSize: ${asset.size}\nUploaded: ${asset.date}`,
    );
  };

  const handleDelete = (asset: AssetItem) => {
    Alert.alert(t('删除素材_azj7'), IS_CN ? `确定要删除 "${asset.name}" 吗？` : `Delete "${asset.name}"?`, [
