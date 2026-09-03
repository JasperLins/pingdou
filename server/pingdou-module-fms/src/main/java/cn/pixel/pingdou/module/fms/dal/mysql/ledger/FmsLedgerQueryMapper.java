package cn.pixel.pingdou.module.fms.dal.mysql.ledger;

import cn.pixel.pingdou.framework.mybatis.core.mapper.BaseMapperX;
import cn.pixel.pingdou.framework.mybatis.core.query.MPJLambdaWrapperX;
import cn.pixel.pingdou.module.fms.controller.admin.ledger.vo.FmsLedgerEntryVO;
import cn.pixel.pingdou.module.fms.dal.dataobject.config.FmsVoucherWordDO;
import cn.pixel.pingdou.module.fms.dal.dataobject.voucher.FmsVoucherDO;
import cn.pixel.pingdou.module.fms.dal.dataobject.voucher.FmsVoucherEntryDO;
import org.apache.ibatis.annotations.Mapper;

import java.time.LocalDateTime;
import java.util.List;

/**
 * FMS 账簿查询 Mapper
 *
 * @author 芋道源码
 */
@Mapper
public interface FmsLedgerQueryMapper extends BaseMapperX<FmsVoucherEntryDO> {

    default List<FmsLedgerEntryVO> selectEntryListBeforeTime(Long accountSetId, LocalDateTime endTime) {
        return selectJoinList(FmsLedgerEntryVO.class,
                new MPJLambdaWrapperX<FmsVoucherEntryDO>()
                        .selectAs(FmsVoucherEntryDO::getId, FmsLedgerEntryVO::getEntryId)
                        .selectAs(FmsVoucherEntryDO::getVoucherId, FmsLedgerEntryVO::getVoucherId)
                        .selectAs(FmsVoucherEntryDO::getSubjectId, FmsLedgerEntryVO::getSubjectId)
                        .selectAs(FmsVoucherDO::getVoucherTime, FmsLedgerEntryVO::getVoucherTime)
                        .selectAs(FmsVoucherDO::getVoucherNumber, FmsLedgerEntryVO::getVoucherNumber)
                        .selectAs(FmsVoucherWordDO::getName, FmsLedgerEntryVO::getVoucherWordName)
                        .selectAs(FmsVoucherEntryDO::getDigest, FmsLedgerEntryVO::getDigest)
                        .selectAs(FmsVoucherEntryDO::getDebitAmount, FmsLedgerEntryVO::getDebitAmount)
                        .selectAs(FmsVoucherEntryDO::getCreditAmount, FmsLedgerEntryVO::getCreditAmount)
                        .selectAs(FmsVoucherEntryDO::getQuantity, FmsLedgerEntryVO::getQuantity)
                        .selectAs(FmsVoucherEntryDO::getUnitPrice, FmsLedgerEntryVO::getUnitPrice)
                        .selectAs(FmsVoucherEntryDO::getSort, FmsLedgerEntryVO::getSort)
                        .selectAs(FmsVoucherEntryDO::getAssistCombinationId,
                                FmsLedgerEntryVO::getAssistCombinationId)
                        .selectAs(FmsVoucherEntryDO::getAuxiliaries, FmsLedgerEntryVO::getAuxiliaries)
                        .eq(FmsVoucherEntryDO::getAccountSetId, accountSetId)
                        .lt(FmsVoucherDO::getVoucherTime, endTime)
                        .innerJoin(FmsVoucherDO.class, FmsVoucherDO::getId,
                                FmsVoucherEntryDO::getVoucherId)
                        .leftJoin(FmsVoucherWordDO.class, FmsVoucherWordDO::getId,
                                FmsVoucherDO::getVoucherWordId)
                        .orderByAsc(FmsVoucherDO::getVoucherTime)
                        .orderByAsc(FmsVoucherDO::getVoucherNumber)
                        .orderByAsc(FmsVoucherDO::getId)
                        .orderByAsc(FmsVoucherEntryDO::getSort)
                        .orderByAsc(FmsVoucherEntryDO::getId));
    }

}
