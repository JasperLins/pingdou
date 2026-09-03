package cn.pixel.pingdou.module.mes.dal.mysql.md.workstation;

import cn.pixel.pingdou.framework.common.pojo.PageResult;
import cn.pixel.pingdou.framework.mybatis.core.mapper.BaseMapperX;
import cn.pixel.pingdou.framework.mybatis.core.query.LambdaQueryWrapperX;
import cn.pixel.pingdou.module.mes.controller.admin.md.workstation.vo.workshop.MesMdWorkshopPageReqVO;
import cn.pixel.pingdou.module.mes.dal.dataobject.md.workstation.MesMdWorkshopDO;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

/**
 * MES 车间 Mapper
 *
 * @author 芋道源码
 */
@Mapper
public interface MesMdWorkshopMapper extends BaseMapperX<MesMdWorkshopDO> {

    default PageResult<MesMdWorkshopDO> selectPage(MesMdWorkshopPageReqVO reqVO) {
        return selectPage(reqVO, new LambdaQueryWrapperX<MesMdWorkshopDO>()
                .eqIfPresent(MesMdWorkshopDO::getCode, reqVO.getCode())
                .likeIfPresent(MesMdWorkshopDO::getName, reqVO.getName())
                .eqIfPresent(MesMdWorkshopDO::getStatus, reqVO.getStatus())
                .orderByDesc(MesMdWorkshopDO::getId));
    }

    default MesMdWorkshopDO selectByCode(String code) {
        return selectOne(MesMdWorkshopDO::getCode, code);
    }

    default MesMdWorkshopDO selectByName(String name) {
        return selectOne(MesMdWorkshopDO::getName, name);
    }

    default List<MesMdWorkshopDO> selectListByStatus(Integer status) {
        return selectList(MesMdWorkshopDO::getStatus, status);
    }

}
