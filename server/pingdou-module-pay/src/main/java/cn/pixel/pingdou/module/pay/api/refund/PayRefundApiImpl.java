package cn.pixel.pingdou.module.pay.api.refund;

import cn.pixel.pingdou.framework.common.util.object.BeanUtils;
import cn.pixel.pingdou.module.pay.api.refund.dto.PayRefundCreateReqDTO;
import cn.pixel.pingdou.module.pay.api.refund.dto.PayRefundRespDTO;
import cn.pixel.pingdou.module.pay.dal.dataobject.refund.PayRefundDO;
import cn.pixel.pingdou.module.pay.service.refund.PayRefundService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

/**
 * 退款单 API 实现类
 *
 * @author 芋道源码
 */
@Service
@Validated
public class PayRefundApiImpl implements PayRefundApi {

    @Resource
    private PayRefundService payRefundService;

    @Override
    public Long createRefund(PayRefundCreateReqDTO reqDTO) {
        return payRefundService.createRefund(reqDTO);
    }

    @Override
    public PayRefundRespDTO getRefund(Long id) {
        PayRefundDO refund = payRefundService.getRefund(id);
        return BeanUtils.toBean(refund, PayRefundRespDTO.class);
    }

}
