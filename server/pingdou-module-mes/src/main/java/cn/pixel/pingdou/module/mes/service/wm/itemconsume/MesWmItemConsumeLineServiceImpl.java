package cn.pixel.pingdou.module.mes.service.wm.itemconsume;

import cn.pixel.pingdou.framework.common.pojo.PageResult;
import cn.pixel.pingdou.module.mes.controller.admin.wm.itemconsume.vo.MesWmItemConsumeLinePageReqVO;
import cn.pixel.pingdou.module.mes.dal.dataobject.wm.itemconsume.MesWmItemConsumeDO;
import cn.pixel.pingdou.module.mes.dal.dataobject.wm.itemconsume.MesWmItemConsumeLineDO;
import cn.pixel.pingdou.module.mes.dal.mysql.wm.itemconsume.MesWmItemConsumeLineMapper;
import jakarta.annotation.Resource;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

import java.util.List;

/**
 * MES 物料消耗记录行 Service 实现类
 *
 * @author 芋道源码
 */
@Service
@Validated
public class MesWmItemConsumeLineServiceImpl implements MesWmItemConsumeLineService {

    @Resource
    private MesWmItemConsumeLineMapper itemConsumeLineMapper;

    @Resource
    @Lazy
    private MesWmItemConsumeService itemConsumeService;

    @Override
    public void createItemConsumeLineBatch(List<MesWmItemConsumeLineDO> lines) {
        itemConsumeLineMapper.insertBatch(lines);
    }

    @Override
    public PageResult<MesWmItemConsumeLineDO> getItemConsumeLinePage(MesWmItemConsumeLinePageReqVO pageReqVO) {
        // 1. 先通过 feedbackId 找到消耗头（通过 Service 调用，不直接注入 Mapper）
        MesWmItemConsumeDO consume = itemConsumeService.getByFeedbackId(pageReqVO.getFeedbackId());
        if (consume == null) {
            return PageResult.empty();
        }
        // 2. 分页查询消耗行
        return itemConsumeLineMapper.selectPage(pageReqVO, consume.getId());
    }

    @Override
    public List<MesWmItemConsumeLineDO> getItemConsumeLineListByConsumeId(Long consumeId) {
        return itemConsumeLineMapper.selectListByConsumeId(consumeId);
    }

}
