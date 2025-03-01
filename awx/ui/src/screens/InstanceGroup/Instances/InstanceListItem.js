import React, { useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { bool, func } from 'prop-types';
import { t, Plural } from '@lingui/macro';
import styled from 'styled-components';
import 'styled-components/macro';
import {
  Progress,
  ProgressMeasureLocation,
  ProgressSize,
  Slider,
  Tooltip,
} from '@patternfly/react-core';
import { Tr, Td, ExpandableRowContent } from '@patternfly/react-table';
import { formatDateString } from 'util/dates';
import { ActionsTd, ActionItem } from 'components/PaginatedTable';
import InstanceToggle from 'components/InstanceToggle';
import StatusLabel from 'components/StatusLabel';
import { Instance } from 'types';
import useRequest, { useDismissableError } from 'hooks/useRequest';
import useDebounce from 'hooks/useDebounce';
import { InstancesAPI } from 'api';
import { useConfig } from 'contexts/Config';
import AlertModal from 'components/AlertModal';
import ErrorDetail from 'components/ErrorDetail';
import { Detail, DetailList } from 'components/DetailList';

const Unavailable = styled.span`
  color: var(--pf-global--danger-color--200);
`;

const SliderHolder = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SliderForks = styled.div`
  flex-grow: 1;
  margin-right: 8px;
  margin-left: 8px;
  text-align: center;
`;

function computeForks(memCapacity, cpuCapacity, selectedCapacityAdjustment) {
  const minCapacity = Math.min(memCapacity, cpuCapacity);
  const maxCapacity = Math.max(memCapacity, cpuCapacity);

  return Math.floor(
    minCapacity + (maxCapacity - minCapacity) * selectedCapacityAdjustment
  );
}

function InstanceListItem({
  instance,
  isExpanded,
  onExpand,
  isSelected,
  onSelect,
  fetchInstances,
  rowIndex,
}) {
  const { me = {} } = useConfig();
  const [forks, setForks] = useState(
    computeForks(
      instance.mem_capacity,
      instance.cpu_capacity,
      instance.capacity_adjustment
    )
  );
  const { id } = useParams();

  const labelId = `check-action-${instance.id}`;

  function usedCapacity(item) {
    if (item.enabled) {
      return (
        <Progress
          value={Math.round(100 - item.percent_capacity_remaining)}
          measureLocation={ProgressMeasureLocation.top}
          size={ProgressSize.sm}
          title={t`Used capacity`}
        />
      );
    }
    return <Unavailable>{t`Unavailable`}</Unavailable>;
  }

  const { error: updateInstanceError, request: updateInstance } = useRequest(
    useCallback(
      async (values) => {
        await InstancesAPI.update(instance.id, values);
      },
      [instance]
    )
  );

  const { error: updateError, dismissError: dismissUpdateError } =
    useDismissableError(updateInstanceError);

  const debounceUpdateInstance = useDebounce(updateInstance, 200);

  const handleChangeValue = (value) => {
    const roundedValue = Math.round(value * 100) / 100;
    setForks(
      computeForks(instance.mem_capacity, instance.cpu_capacity, roundedValue)
    );
    debounceUpdateInstance({ capacity_adjustment: roundedValue });
  };

  return (
    <>
      <Tr id={`instance-row-${instance.id}`}>
        <Td
          expand={{
            rowIndex,
            isExpanded,
            onToggle: onExpand,
          }}
        />
        <Td
          select={{
            rowIndex,
            isSelected,
            onSelect,
          }}
          dataLabel={t`Selected`}
        />
        <Td id={labelId} dataLabel={t`Name`}>
          <Link to={`/instance_groups/${id}/instances/${instance.id}/details`}>
            <b>{instance.hostname}</b>
          </Link>
        </Td>
        <Td dataLabel={t`Status`}>
          <Tooltip
            content={
              <div>
                {t`Last Health Check`}
                &nbsp;
                {formatDateString(instance.last_health_check)}
              </div>
            }
          >
            <StatusLabel status={instance.errors ? 'error' : 'healthy'} />
          </Tooltip>
        </Td>
        <Td dataLabel={t`Running Jobs`}>{instance.jobs_running}</Td>
        <Td dataLabel={t`Total Jobs`}>{instance.jobs_total}</Td>
        <Td dataLabel={t`Capacity Adjustment`}>
          <SliderHolder data-cy="slider-holder">
            <div data-cy="cpu-capacity">{t`CPU ${instance.cpu_capacity}`}</div>
            <SliderForks data-cy="slider-forks">
              <div data-cy="number-forks">
                <Plural value={forks} one="# fork" other="# forks" />
              </div>
              <Slider
                areCustomStepsContinuous
                max={1}
                min={0}
                step={0.1}
                value={instance.capacity_adjustment}
                onChange={handleChangeValue}
                isDisabled={!me?.is_superuser || !instance.enabled}
                data-cy="slider"
              />
            </SliderForks>
            <div data-cy="mem-capacity">{t`RAM ${instance.mem_capacity}`}</div>
          </SliderHolder>
        </Td>
        <Td
          dataLabel={t`Instance group used capacity`}
          css="--pf-c-table--cell--MinWidth: 175px;"
        >
          {usedCapacity(instance)}
        </Td>
        <ActionsTd
          dataLabel={t`Actions`}
          css="--pf-c-table--cell--Width: 125px"
        >
          <ActionItem visible>
            <InstanceToggle
              css="display: inline-flex;"
              fetchInstances={fetchInstances}
              instance={instance}
            />
          </ActionItem>
        </ActionsTd>
      </Tr>
      <Tr isExpanded={isExpanded}>
        <Td colSpan={2} />
        <Td colSpan={7}>
          <ExpandableRowContent>
            <DetailList>
              <Detail label={t`Node Type`} value={instance.node_type} />
              <Detail
                label={t`Policy Type`}
                value={instance.managed_by_policy ? t`Auto` : t`Manual`}
              />
              <Detail
                label={t`Last Health Check`}
                value={formatDateString(instance.last_health_check)}
              />
            </DetailList>
          </ExpandableRowContent>
        </Td>
      </Tr>
      {updateError && (
        <AlertModal
          variant="error"
          title={t`Error!`}
          isOpen
          onClose={dismissUpdateError}
        >
          {t`Failed to update capacity adjustment.`}
          <ErrorDetail error={updateError} />
        </AlertModal>
      )}
    </>
  );
}

InstanceListItem.prototype = {
  instance: Instance.isRequired,
  isSelected: bool.isRequired,
  onSelect: func.isRequired,
};

export default InstanceListItem;
