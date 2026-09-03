package cn.pixel.pingdou.module.mes.dal.mysql.cal.holiday;

import cn.pixel.pingdou.framework.mybatis.core.mapper.BaseMapperX;
import cn.pixel.pingdou.framework.mybatis.core.query.LambdaQueryWrapperX;
import cn.pixel.pingdou.module.mes.dal.dataobject.cal.holiday.MesCalHolidayDO;
import org.apache.ibatis.annotations.Mapper;

import java.time.LocalDateTime;
import java.util.List;

/**
 * MES 假期设置 Mapper
 *
 * @author 芋道源码
 */
@Mapper
public interface MesCalHolidayMapper extends BaseMapperX<MesCalHolidayDO> {

    default MesCalHolidayDO selectByDay(LocalDateTime day) {
        return selectOne(MesCalHolidayDO::getDay, day);
    }

    default List<MesCalHolidayDO> selectList(LocalDateTime startDay, LocalDateTime endDay) {
        return selectList(new LambdaQueryWrapperX<MesCalHolidayDO>()
                .betweenIfPresent(MesCalHolidayDO::getDay, startDay, endDay)
                .orderByAsc(MesCalHolidayDO::getDay));
    }

}
