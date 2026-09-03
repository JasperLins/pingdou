package cn.pixel.pingdou.module.mes.dal.mysql.dv.checkrecord;

import cn.pixel.pingdou.framework.common.pojo.PageResult;
import cn.pixel.pingdou.framework.mybatis.core.mapper.BaseMapperX;
import cn.pixel.pingdou.framework.mybatis.core.query.LambdaQueryWrapperX;
import cn.pixel.pingdou.module.mes.controller.admin.dv.checkrecord.vo.MesDvCheckRecordPageReqVO;
import cn.pixel.pingdou.module.mes.dal.dataobject.dv.checkrecord.MesDvCheckRecordDO;
import org.apache.ibatis.annotations.Mapper;

/**
 * MES 设备点检记录 Mapper
 *
 * @author 芋道源码
 */
@Mapper
public interface MesDvCheckRecordMapper extends BaseMapperX<MesDvCheckRecordDO> {

    default PageResult<MesDvCheckRecordDO> selectPage(MesDvCheckRecordPageReqVO reqVO) {
        return selectPage(reqVO, new LambdaQueryWrapperX<MesDvCheckRecordDO>()
                .eqIfPresent(MesDvCheckRecordDO::getPlanId, reqVO.getPlanId())
                .eqIfPresent(MesDvCheckRecordDO::getMachineryId, reqVO.getMachineryId())
                .eqIfPresent(MesDvCheckRecordDO::getUserId, reqVO.getUserId())
                .eqIfPresent(MesDvCheckRecordDO::getStatus, reqVO.getStatus())
                .betweenIfPresent(MesDvCheckRecordDO::getCheckTime, reqVO.getCheckTime())
                .orderByDesc(MesDvCheckRecordDO::getId));
    }

    default Long selectCountByMachineryId(Long machineryId) {
        return selectCount(MesDvCheckRecordDO::getMachineryId, machineryId);
    }

}
