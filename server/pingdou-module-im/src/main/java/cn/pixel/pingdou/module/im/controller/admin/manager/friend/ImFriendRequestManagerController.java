package cn.pixel.pingdou.module.im.controller.admin.manager.friend;

import cn.hutool.core.collection.CollUtil;
import cn.pixel.pingdou.framework.common.pojo.CommonResult;
import cn.pixel.pingdou.framework.common.pojo.PageResult;
import cn.pixel.pingdou.framework.common.util.collection.MapUtils;
import cn.pixel.pingdou.framework.common.util.object.BeanUtils;
import cn.pixel.pingdou.module.im.controller.admin.manager.friend.vo.ImFriendRequestManagerPageReqVO;
import cn.pixel.pingdou.module.im.controller.admin.manager.friend.vo.ImFriendRequestManagerRespVO;
import cn.pixel.pingdou.module.im.dal.dataobject.friend.ImFriendRequestDO;
import cn.pixel.pingdou.module.im.service.friend.ImFriendRequestService;
import cn.pixel.pingdou.module.system.api.user.AdminUserApi;
import cn.pixel.pingdou.module.system.api.user.dto.AdminUserRespDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

import static cn.pixel.pingdou.framework.common.pojo.CommonResult.success;
import static cn.pixel.pingdou.framework.common.util.collection.CollectionUtils.convertSetByFlatMap;

@Tag(name = "管理后台 - IM 好友申请管理")
@RestController
@RequestMapping("/im/manager/friend-request")
@Validated
public class ImFriendRequestManagerController {

    @Resource
    private ImFriendRequestService friendRequestService;
    @Resource
    private AdminUserApi adminUserApi;

    @GetMapping("/page")
    @Operation(summary = "获得好友申请分页")
    @PreAuthorize("@ss.hasPermission('im:manager:friend-request:query')")
    public CommonResult<PageResult<ImFriendRequestManagerRespVO>> getFriendRequestPage(
            @Valid ImFriendRequestManagerPageReqVO pageReqVO) {
        // 1. 分页查询
        PageResult<ImFriendRequestDO> pageResult = friendRequestService.getFriendRequestPage(pageReqVO);
        if (CollUtil.isEmpty(pageResult.getList())) {
            return success(PageResult.empty(pageResult.getTotal()));
        }

        // 2.1 一次性批量查询发起方 + 接收方的昵称
        Set<Long> userIds = convertSetByFlatMap(pageResult.getList(),
                request -> Stream.of(request.getFromUserId(), request.getToUserId()));
        Map<Long, AdminUserRespDTO> userMap = adminUserApi.getUserMap(userIds);
        // 2.2 转换为 VO，填充昵称
        return success(BeanUtils.toBean(pageResult, ImFriendRequestManagerRespVO.class, vo -> {
            MapUtils.findAndThen(userMap, vo.getFromUserId(),
                    user -> vo.setFromNickname(user.getNickname()));
            MapUtils.findAndThen(userMap, vo.getToUserId(),
                    user -> vo.setToNickname(user.getNickname()));
        }));
    }

}
