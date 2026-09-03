package cn.pixel.pingdou.module.crm.service.permission;

import cn.hutool.core.collection.CollUtil;
import cn.pixel.pingdou.framework.common.util.object.BeanUtils;
import cn.pixel.pingdou.module.crm.controller.admin.statistics.vo.customer.CrmStatisticsCustomerReqVO;
import cn.pixel.pingdou.module.crm.controller.admin.statistics.vo.customer.CrmStatisticsPoolSummaryByDateRespVO;
import cn.pixel.pingdou.module.crm.controller.admin.statistics.vo.customer.CrmStatisticsPoolSummaryByUserRespVO;
import cn.pixel.pingdou.module.crm.dal.dataobject.permission.CrmOwnerRecordDO;
import cn.pixel.pingdou.module.crm.dal.mysql.permission.CrmOwnerRecordMapper;
import cn.pixel.pingdou.module.crm.service.permission.bo.CrmOwnerRecordCreateReqBO;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

import java.util.List;

/**
 * CRM 负责人变更记录 Service 实现类
 *
 * @author 芋道源码
 */
@Service
@Validated
public class CrmOwnerRecordServiceImpl implements CrmOwnerRecordService {

    @Resource
    private CrmOwnerRecordMapper ownerRecordMapper;

    @Override
    public Long createOwnerRecord(CrmOwnerRecordCreateReqBO createReqBO) {
        CrmOwnerRecordDO ownerRecord = BeanUtils.toBean(createReqBO, CrmOwnerRecordDO.class);
        ownerRecordMapper.insert(ownerRecord);
        return ownerRecord.getId();
    }

    @Override
    public void createOwnerRecordList(List<CrmOwnerRecordCreateReqBO> createReqBOs) {
        if (CollUtil.isEmpty(createReqBOs)) {
            return;
        }
        List<CrmOwnerRecordDO> list = BeanUtils.toBean(createReqBOs, CrmOwnerRecordDO.class);
        ownerRecordMapper.insertBatch(list);
    }

    @Override
    public List<CrmStatisticsPoolSummaryByDateRespVO> getPoolCustomerPutCountByDate(CrmStatisticsCustomerReqVO reqVO) {
        return ownerRecordMapper.selectPoolCustomerPutCountByDate(reqVO);
    }

    @Override
    public List<CrmStatisticsPoolSummaryByDateRespVO> getPoolCustomerTakeCountByDate(CrmStatisticsCustomerReqVO reqVO) {
        return ownerRecordMapper.selectPoolCustomerTakeCountByDate(reqVO);
    }

    @Override
    public List<CrmStatisticsPoolSummaryByUserRespVO> getPoolCustomerPutCountByUser(CrmStatisticsCustomerReqVO reqVO) {
        return ownerRecordMapper.selectPoolCustomerPutCountByUser(reqVO);
    }

    @Override
    public List<CrmStatisticsPoolSummaryByUserRespVO> getPoolCustomerTakeCountByUser(CrmStatisticsCustomerReqVO reqVO) {
        return ownerRecordMapper.selectPoolCustomerTakeCountByUser(reqVO);
    }

}
