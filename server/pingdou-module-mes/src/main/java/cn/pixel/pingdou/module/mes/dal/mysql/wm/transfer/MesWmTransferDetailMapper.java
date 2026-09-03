package cn.pixel.pingdou.module.mes.dal.mysql.wm.transfer;

import cn.pixel.pingdou.framework.mybatis.core.mapper.BaseMapperX;
import cn.pixel.pingdou.framework.mybatis.core.query.LambdaQueryWrapperX;
import cn.pixel.pingdou.module.mes.dal.dataobject.wm.transfer.MesWmTransferDetailDO;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

/**
 * MES 调拨明细 Mapper
 */
@Mapper
public interface MesWmTransferDetailMapper extends BaseMapperX<MesWmTransferDetailDO> {

    default List<MesWmTransferDetailDO> selectListByLineId(Long lineId) {
        return selectList(new LambdaQueryWrapperX<MesWmTransferDetailDO>()
                .eq(MesWmTransferDetailDO::getLineId, lineId)
                .orderByAsc(MesWmTransferDetailDO::getId));
    }

    default List<MesWmTransferDetailDO> selectListByTransferId(Long transferId) {
        return selectList(new LambdaQueryWrapperX<MesWmTransferDetailDO>()
                .eq(MesWmTransferDetailDO::getTransferId, transferId)
                .orderByAsc(MesWmTransferDetailDO::getId));
    }

    default void deleteByLineId(Long lineId) {
        delete(MesWmTransferDetailDO::getLineId, lineId);
    }

    default void deleteByTransferId(Long transferId) {
        delete(MesWmTransferDetailDO::getTransferId, transferId);
    }

}
