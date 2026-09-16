/**
 * Citations shown beneath an assistant answer (requirement 16).
 *
 * Every entry comes from a chunk that was actually retrieved; the page numbers
 * are PDF metadata recorded at index time, never produced by the model.
 */

import styled from 'styled-components';
import { theme } from '../theme';

const Wrapper = styled.div`
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid ${theme.color.lineSoft};
`;

const Heading = styled.p`
  margin: 0 0 8px;
  font-size: 12.5px;
  font-weight: 500;
  color: ${theme.color.inkFaint};
`;

const List = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Item = styled.li`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: ${theme.color.accentSoft};
  color: ${theme.color.accentHover};
  border-radius: ${theme.radius.pill};
  font-size: 12.5px;
`;

export default function Sources({ sources }) {
  if (!sources?.length) return null;

  return (
    <Wrapper>
      <Heading>{sources.length === 1 ? 'Source' : 'Sources'}</Heading>
      <List>
        {sources.map((source, index) => (
          <Item key={`${source.document}-${source.page}-${index}`}>
            <span aria-hidden="true">📄</span>
            <span>
              {source.document}
              {source.page != null && ` — page ${source.page}`}
            </span>
          </Item>
        ))}
      </List>
    </Wrapper>
  );
}
