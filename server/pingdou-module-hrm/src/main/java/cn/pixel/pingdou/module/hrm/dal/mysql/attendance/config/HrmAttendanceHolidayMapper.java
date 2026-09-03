package cn.pixel.pingdou.module.hrm.dal.mysql.attendance.config;

import cn.pixel.pingdou.framework.common.pojo.PageResult;
import cn.pixel.pingdou.framework.mybatis.core.mapper.BaseMapperX;
import cn.pixel.pingdou.framework.mybatis.core.query.LambdaQueryWrapperX;
import cn.pixel.pingdou.module.hrm.controller.admin.attendance.vo.holiday.HrmAttendanceHolidayPageReqVO;
import cn.pixel.pingdou.module.hrm.dal.dataobject.attendance.config.HrmAttendanceHolidayDO;
import org.apache.ibatis.annotations.Mapper;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface HrmAttendanceHolidayMapper extends BaseMapperX<HrmAttendanceHolidayDO> {

    default PageResult<HrmAttendanceHolidayDO> selectPage(HrmAttendanceHolidayPageReqVO reqVO) {
        return selectPage(reqVO, new LambdaQueryWrapperX<HrmAttendanceHolidayDO>()
                .eqIfPresent(HrmAttendanceHolidayDO::getType, reqVO.getType())
                .betweenIfPresent(HrmAttendanceHolidayDO::getDate, reqVO.getDate())
                .orderByDesc(HrmAttendanceHolidayDO::getDate)
                .orderByDesc(HrmAttendanceHolidayDO::getId));
    }

    default HrmAttendanceHolidayDO selectByDate(LocalDateTime date) {
        return selectLastOne(new LambdaQueryWrapperX<HrmAttendanceHolidayDO>()
                .eq(HrmAttendanceHolidayDO::getDate, date)
                .orderByAsc(HrmAttendanceHolidayDO::getId));
    }

    default List<HrmAttendanceHolidayDO> selectListByDateRange(LocalDateTime[] dateTimes) {
        return selectList(new LambdaQueryWrapperX<HrmAttendanceHolidayDO>()
                .betweenIfPresent(HrmAttendanceHolidayDO::getDate, dateTimes)
                .orderByAsc(HrmAttendanceHolidayDO::getDate)
                .orderByDesc(HrmAttendanceHolidayDO::getId));
    }

}
