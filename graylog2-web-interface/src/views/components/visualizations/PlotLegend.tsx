/*
 * Copyright (C) 2020 Graylog, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the Server Side Public License, version 1,
 * as published by MongoDB, Inc.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * Server Side Public License for more details.
 *
 * You should have received a copy of the Server Side Public License
 * along with this program. If not, see
 * <http://www.mongodb.com/licensing/server-side-public-license>.
 */
import * as React from 'react';
import { useContext, useCallback, useMemo, useState } from 'react';
import styled, { css } from 'styled-components';
import chunk from 'lodash/chunk';

import ColorPicker from 'components/common/ColorPicker';
import Value from 'views/components/Value';
import type AggregationWidgetConfig from 'views/logic/aggregationbuilder/AggregationWidgetConfig';
import ChartColorContext from 'views/components/visualizations/ChartColorContext';
import Popover from 'components/common/Popover';
import FieldType from 'views/logic/fieldtypes/FieldType';
import { colors as defaultColors } from 'views/components/visualizations/Colors';
import { EVENT_COLOR, eventsDisplayName } from 'views/logic/searchtypes/events/EventHandler';
import WidgetFocusContext from 'views/components/contexts/WidgetFocusContext';
import type { FieldTypes } from 'views/components/contexts/FieldTypesContext';
import FieldTypesContext from 'views/components/contexts/FieldTypesContext';
import useActiveQueryId from 'views/hooks/useActiveQueryId';
import type { ChartDefinition } from 'views/components/visualizations/ChartData';
import { keySeparator, humanSeparator } from 'views/Constants';
import useMapKeys from 'views/components/visualizations/useMapKeys';
import type ColorMapper from 'views/components/visualizations/ColorMapper';
import type { KeyMapper } from 'views/components/visualizations/TransformKeys';
import InteractiveContext from 'views/components/contexts/InteractiveContext';

const ColorHint = styled.div(({ color }) => css`
  cursor: pointer;
  background-color: ${color} !important; /* Needed for report generation */
  -webkit-print-color-adjust: exact !important; /* Needed for report generation */
  width: 12px;
  height: 12px;
`);

const Container = styled.div`
  display: grid;
  grid-template: 4fr auto / 1fr;
  grid-template-areas: '.' '.';
  height: 100%;
`;

const LegendContainer = styled.div`
  padding: 5px;
  max-height: 100px;
  overflow: auto;
`;

const Legend = styled.div`
  display: table;
  width: 100%;
`;

const LegendRow = styled.div`
  display: table-row;
`;

const LegendCell = styled.div`
  padding: 4px;
  display: table-cell;
`;

const LegendEntry = styled.div`
  display: flex;
  align-items: center;
`;

const ValueContainer = styled.div`
  margin-left: 8px;
  line-height: 1;
`;

type Props = {
  children: React.ReactNode,
  config: AggregationWidgetConfig,
  chartData: any,
  labelFields?: (config: Props['config']) => Array<string>,
  labelMapper?: (data: Array<any>) => Array<string> | undefined | null,
  neverHide?: boolean,
};

const defaultLabelMapper = (data: Array<Pick<ChartDefinition, 'name' | 'originalName'>>) => data.map(({
  name,
  originalName,
}) => originalName ?? name);

const stringLenSort = (s1: string, s2: string) => {
  if (s1.length < s2.length) {
    return -1;
  }

  if (s1.length === s2.length) {
    return 0;
  }

  return 1;
};

const columnPivotsToFields = (config: Props['config']) => config?.columnPivots?.flatMap((pivot) => pivot.fields) ?? [];

type TableCellProps = {
  value: string,
  fieldTypes: FieldTypes,
  colors: ColorMapper,
  activeQuery: string,
  labelFields: string[],
  mapKeys: KeyMapper,
  setColor: (name: string, newColor: string) => void,
}

const TableCell = ({ value, fieldTypes, colors, activeQuery, labelFields, mapKeys, setColor }:TableCellProps) => {
  const interactive = useContext(InteractiveContext);
  const [showPopover, setShowPopover] = useState(false);
  const labelsWithField = value.split(keySeparator).map((label, idx) => {
    const field = labelFields[idx];
    const fieldType = fieldTypes?.queryFields?.get(activeQuery)?.find((type) => type.name === field)?.type ?? FieldType.Unknown;

    return { label, field, type: fieldType };
  });
  const defaultColor = value === eventsDisplayName ? EVENT_COLOR : undefined;
  const val = labelsWithField.map(({ label, field, type }) => (field
    ? <Value key={`${field}:${label}`} type={type} value={label} field={field} />
    : label));
  const humanLabel = Object.values(labelsWithField).map(({
    label,
    field,
  }) => mapKeys(label, field)).join(humanSeparator);

  const _onColorSelect = useCallback((color: string) => {
    setColor(value, color);
    setShowPopover(false);
  }, [setColor, value]);

  const togglePopover = useMemo(() => (interactive ? () => setShowPopover((show) => !show) : () => {}), [interactive]);

  return (
    <LegendCell key={value}>
      <LegendEntry>
        <Popover position="top" withArrow opened={showPopover}>
          <Popover.Target>
            <ColorHint aria-label="Color Hint"
                       onClick={togglePopover}
                       color={colors.get(value, defaultColor)} />
          </Popover.Target>
          <Popover.Dropdown title={`Configuration for ${humanLabel}`}>
            <ColorPicker color={colors.get(value, defaultColor)}
                         colors={defaultColors}
                         onChange={_onColorSelect} />
          </Popover.Dropdown>
        </Popover>
        <ValueContainer>
          {val}
        </ValueContainer>
      </LegendEntry>
    </LegendCell>
  );
};

const PlotLegend = ({
  children,
  config,
  chartData,
  labelMapper = defaultLabelMapper,
  labelFields = columnPivotsToFields,
  neverHide,
}: Props) => {
  const { columnPivots, series } = config;
  const labels: Array<string> = labelMapper(chartData);
  const { colors, setColor } = useContext(ChartColorContext);
  const { focusedWidget } = useContext(WidgetFocusContext);
  const fieldTypes = useContext(FieldTypesContext);
  const activeQuery = useActiveQueryId();
  const mapKeys = useMapKeys();

  const _labelFields = useMemo(() => labelFields(config), [config, labelFields]);

  if (!neverHide && (!focusedWidget || !focusedWidget.editing) && series.length <= 1 && columnPivots.length <= 0) {
    return <>{children}</>;
  }

  const tableCells = labels.sort(stringLenSort).map((value) => (
    <TableCell key={value}
               colors={colors}
               value={value}
               labelFields={_labelFields}
               setColor={setColor}
               mapKeys={mapKeys}
               fieldTypes={fieldTypes}
               activeQuery={activeQuery} />
  ));

  const result = chunk(tableCells, 5).map((cells, index) => (
    // eslint-disable-next-line react/no-array-index-key
    <LegendRow key={index}>
      {cells}
    </LegendRow>
  ));

  return (
    <Container>
      {children}
      <LegendContainer>
        <Legend>{result}</Legend>
      </LegendContainer>
    </Container>
  );
};

PlotLegend.defaultProps = {
  labelFields: columnPivotsToFields,
  labelMapper: defaultLabelMapper,
  neverHide: false,
};

export default PlotLegend;
