package cn.pixel.pingdou.module.mes.dal.mysql.wm.itemreceipt;

import cn.pixel.pingdou.framework.common.pojo.PageResult;
import cn.pixel.pingdou.framework.mybatis.core.mapper.BaseMapperX;
import cn.pixel.pingdou.framework.mybatis.core.query.LambdaQueryWrapperX;
import cn.pixel.pingdou.module.mes.controller.admin.wm.itemreceipt.vo.MesWmItemReceiptPageReqVO;
import cn.pixel.pingdou.module.mes.dal.dataobject.wm.itemreceipt.MesWmItemReceiptDO;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

/**
 * MES 采购入库单 Mapper
 */
@Mapper
public interface MesWmItemReceiptMapper extends BaseMapperX<MesWmItemReceiptDO> {

    default PageResult<MesWmItemReceiptDO> selectPage(MesWmItemReceiptPageReqVO reqVO) {
        return selectPage(reqVO, new LambdaQueryWrapperX<MesWmItemReceiptDO>()
                .likeIfPresent(MesWmItemReceiptDO::getCode, reqVO.getCode())
                .likeIfPresent(MesWmItemReceiptDO::getName, reqVO.getName())
                .eqIfPresent(MesWmItemReceiptDO::getVendorId, reqVO.getVendorId())
                .betweenIfPresent(MesWmItemReceiptDO::getReceiptDate, reqVO.getReceiptDate())
                .orderByDesc(MesWmItemReceiptDO::getId));
    }

    default MesWmItemReceiptDO selectByCode(String code) {
        return selectOne(MesWmItemReceiptDO::getCode, code);
    }

    default Long selectCountByVendorId(Long vendorId) {
        return selectCount(MesWmItemReceiptDO::getVendorId, vendorId);
    }

    default List<MesWmItemReceiptDO> selectListByVendorId(Long vendorId) {
        return selectList(MesWmItemReceiptDO::getVendorId, vendorId);
    }

}
