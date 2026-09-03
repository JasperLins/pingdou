package cn.pixel.pingdou.module.mes.service.wm.sn;

import cn.pixel.pingdou.framework.common.pojo.PageResult;
import cn.pixel.pingdou.module.mes.controller.admin.wm.sn.vo.MesWmSnGenerateReqVO;
import cn.pixel.pingdou.module.mes.controller.admin.wm.sn.vo.MesWmSnGroupRespVO;
import cn.pixel.pingdou.module.mes.controller.admin.wm.sn.vo.MesWmSnPageReqVO;
import cn.pixel.pingdou.module.mes.dal.dataobject.wm.sn.MesWmSnDO;

import java.util.List;

/**
 * MES SN 码 Service 接口
 *
 * @author 芋道源码
 */
public interface MesWmSnService {

    /**
     * 批量生成 SN 码
     *
     * @param reqVO 生成请求
     */
    void generateSnCodes(MesWmSnGenerateReqVO reqVO);

    /**
     * 获得 SN 码分组分页（按 UUID 聚合）
     *
     * @param reqVO 分页查询
     * @return SN 码分组分页
     */
    PageResult<MesWmSnGroupRespVO> getSnGroupPage(MesWmSnPageReqVO reqVO);

    /**
     * 获得批次 SN 码列表
     *
     * @param uuid 批次 UUID
     * @return SN 码列表
     */
    List<MesWmSnDO> getSnListByUuid(String uuid);

    /**
     * 批量删除 SN 码（按批次 UUID）
     *
     * @param uuid 批次 UUID
     */
    void deleteSnByUuid(String uuid);

}
