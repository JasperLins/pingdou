package cn.pixel.pingdou.module.wms.dal.mysql.inventory;

import cn.pixel.pingdou.framework.common.pojo.PageResult;
import cn.pixel.pingdou.framework.mybatis.core.mapper.BaseMapperX;
import cn.pixel.pingdou.framework.mybatis.core.query.MPJLambdaWrapperX;
import cn.pixel.pingdou.module.wms.controller.admin.inventory.vo.history.WmsInventoryHistoryPageReqVO;
import cn.pixel.pingdou.module.wms.dal.dataobject.inventory.WmsInventoryHistoryDO;
import cn.pixel.pingdou.module.wms.dal.dataobject.md.item.WmsItemDO;
import cn.pixel.pingdou.module.wms.dal.dataobject.md.item.WmsItemSkuDO;
import org.apache.ibatis.annotations.Mapper;

/**
 * WMS 库存流水 Mapper
 *
 * @author 芋道源码
 */
@Mapper
public interface WmsInventoryHistoryMapper extends BaseMapperX<WmsInventoryHistoryDO> {

    default PageResult<WmsInventoryHistoryDO> selectPage(WmsInventoryHistoryPageReqVO reqVO) {
        MPJLambdaWrapperX<WmsInventoryHistoryDO> query = new MPJLambdaWrapperX<WmsInventoryHistoryDO>()
                .selectAll(WmsInventoryHistoryDO.class)
                .leftJoin(WmsItemSkuDO.class, WmsItemSkuDO::getId, WmsInventoryHistoryDO::getSkuId)
                .leftJoin(WmsItemDO.class, WmsItemDO::getId, WmsItemSkuDO::getItemId)
                .likeIfPresent(WmsItemDO::getCode, reqVO.getItemCode())
                .likeIfPresent(WmsItemDO::getName, reqVO.getItemName())
                .eqIfPresent(WmsInventoryHistoryDO::getSkuId, reqVO.getSkuId())
                .likeIfPresent(WmsItemSkuDO::getCode, reqVO.getSkuCode())
                .likeIfPresent(WmsItemSkuDO::getName, reqVO.getSkuName())
                .eqIfPresent(WmsInventoryHistoryDO::getWarehouseId, reqVO.getWarehouseId())
                .eqIfPresent(WmsInventoryHistoryDO::getOrderNo, reqVO.getOrderNo())
                .eqIfPresent(WmsInventoryHistoryDO::getOrderType, reqVO.getOrderType())
                .betweenIfPresent(WmsInventoryHistoryDO::getCreateTime, reqVO.getCreateTime())
                .orderByDesc(WmsInventoryHistoryDO::getCreateTime)
                .orderByDesc(WmsInventoryHistoryDO::getId);
        return selectJoinPage(reqVO, WmsInventoryHistoryDO.class, query);
    }

}
