package cn.pixel.pingdou.module.hrm.dal.mysql.config;

import cn.pixel.pingdou.framework.mybatis.core.mapper.BaseMapperX;
import cn.pixel.pingdou.framework.mybatis.core.query.LambdaQueryWrapperX;
import cn.pixel.pingdou.module.hrm.dal.dataobject.config.HrmConfigDO;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface HrmConfigMapper extends BaseMapperX<HrmConfigDO> {

    default List<HrmConfigDO> selectListByType(Integer type) {
        return selectList(new LambdaQueryWrapperX<HrmConfigDO>()
                .eq(HrmConfigDO::getType, type)
                .orderByAsc(HrmConfigDO::getSort)
                .orderByAsc(HrmConfigDO::getId));
    }

    default void deleteByType(Integer type) {
        delete(new LambdaQueryWrapperX<HrmConfigDO>().eq(HrmConfigDO::getType, type));
    }

}
