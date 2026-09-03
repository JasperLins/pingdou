package cn.pixel.pingdou.module.mes.dal.mysql.wm.barcode;

import cn.pixel.pingdou.framework.common.pojo.PageResult;
import cn.pixel.pingdou.framework.mybatis.core.mapper.BaseMapperX;
import cn.pixel.pingdou.framework.mybatis.core.query.LambdaQueryWrapperX;
import cn.pixel.pingdou.module.mes.controller.admin.wm.barcode.vo.config.MesWmBarcodeConfigPageReqVO;
import cn.pixel.pingdou.module.mes.dal.dataobject.wm.barcode.MesWmBarcodeConfigDO;
import org.apache.ibatis.annotations.Mapper;

/**
 * MES 条码配置 Mapper
 *
 * @author 芋道源码
 */
@Mapper
public interface MesWmBarcodeConfigMapper extends BaseMapperX<MesWmBarcodeConfigDO> {

    default PageResult<MesWmBarcodeConfigDO> selectPage(MesWmBarcodeConfigPageReqVO reqVO) {
        return selectPage(reqVO, new LambdaQueryWrapperX<MesWmBarcodeConfigDO>()
                .eqIfPresent(MesWmBarcodeConfigDO::getFormat, reqVO.getFormat())
                .eqIfPresent(MesWmBarcodeConfigDO::getBizType, reqVO.getBizType())
                .eqIfPresent(MesWmBarcodeConfigDO::getAutoGenerateFlag, reqVO.getAutoGenerateFlag())
                .eqIfPresent(MesWmBarcodeConfigDO::getStatus, reqVO.getStatus())
                .betweenIfPresent(MesWmBarcodeConfigDO::getCreateTime, reqVO.getCreateTime())
                .orderByDesc(MesWmBarcodeConfigDO::getId));
    }

    default MesWmBarcodeConfigDO selectByBizType(Integer bizType) {
        return selectOne(MesWmBarcodeConfigDO::getBizType, bizType);
    }

}
