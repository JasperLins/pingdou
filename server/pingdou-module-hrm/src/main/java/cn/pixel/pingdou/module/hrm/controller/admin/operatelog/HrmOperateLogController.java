package cn.pixel.pingdou.module.hrm.controller.admin.operatelog;

import cn.pixel.pingdou.framework.common.pojo.CommonResult;
import cn.pixel.pingdou.framework.common.pojo.PageResult;
import cn.pixel.pingdou.framework.common.util.object.BeanUtils;
import cn.pixel.pingdou.module.hrm.controller.admin.operatelog.vo.HrmOperateLogPageReqVO;
import cn.pixel.pingdou.module.hrm.controller.admin.operatelog.vo.HrmOperateLogRespVO;
import cn.pixel.pingdou.module.hrm.enums.LogRecordConstants;
import cn.pixel.pingdou.module.hrm.enums.common.HrmBizTypeEnum;
import cn.pixel.pingdou.module.system.api.logger.OperateLogApi;
import cn.pixel.pingdou.module.system.api.logger.dto.OperateLogPageReqDTO;
import cn.pixel.pingdou.module.system.api.logger.dto.OperateLogRespDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

import static cn.pixel.pingdou.framework.common.pojo.CommonResult.success;
import static cn.pixel.pingdou.framework.common.pojo.PageParam.PAGE_SIZE_NONE;
import static cn.pixel.pingdou.module.hrm.enums.LogRecordConstants.HRM_EMPLOYEE_TYPE;
import static cn.pixel.pingdou.module.hrm.enums.LogRecordConstants.HRM_PERFORMANCE_PLAN_TYPE;
import static cn.pixel.pingdou.module.hrm.enums.LogRecordConstants.HRM_PERFORMANCE_TYPE;
import static cn.pixel.pingdou.module.hrm.enums.LogRecordConstants.HRM_RECRUIT_CANDIDATE_TYPE;
import static cn.pixel.pingdou.module.hrm.enums.LogRecordConstants.HRM_RECRUIT_POST_TYPE;

@Tag(name = "管理后台 - HRM 操作日志")
@RestController
@RequestMapping("/hrm/operate-log")
@Validated
public class HrmOperateLogController {

    private static final Map<Integer, String> BIZ_TYPE_MAP = new HashMap<>();

    static {
        BIZ_TYPE_MAP.put(HrmBizTypeEnum.RECRUIT_POST.getType(), HRM_RECRUIT_POST_TYPE);
        BIZ_TYPE_MAP.put(HrmBizTypeEnum.RECRUIT_CANDIDATE.getType(), HRM_RECRUIT_CANDIDATE_TYPE);
        BIZ_TYPE_MAP.put(HrmBizTypeEnum.EMPLOYEE.getType(), HRM_EMPLOYEE_TYPE);
        BIZ_TYPE_MAP.put(HrmBizTypeEnum.PERFORMANCE_ASSESSMENT.getType(), HRM_PERFORMANCE_TYPE);
        BIZ_TYPE_MAP.put(HrmBizTypeEnum.PERFORMANCE_PLAN.getType(), HRM_PERFORMANCE_PLAN_TYPE);
    }

    @Resource
    private OperateLogApi operateLogApi;

    @GetMapping("/page")
    @Operation(summary = "获得操作日志")
    @PreAuthorize("@ss.hasAnyPermissions('hrm:recruit:post:query', 'hrm:recruit:candidate:query', "
            + "'hrm:employee:query', 'hrm:performance:plan:query')")
    public CommonResult<PageResult<HrmOperateLogRespVO>> getOperateLogPage(
            @Valid HrmOperateLogPageReqVO pageReqVO) {
        OperateLogPageReqDTO reqDTO = new OperateLogPageReqDTO();
        reqDTO.setPageSize(PAGE_SIZE_NONE);
        reqDTO.setType(BIZ_TYPE_MAP.get(pageReqVO.getBizType()));
        reqDTO.setBizId(pageReqVO.getBizId());
        PageResult<OperateLogRespDTO> pageResult = operateLogApi.getOperateLogPage(reqDTO);
        return success(BeanUtils.toBean(pageResult, HrmOperateLogRespVO.class));
    }

}
