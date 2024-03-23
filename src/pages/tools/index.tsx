import React from 'react'
import styles from './index.module.css'
import {Tabs, Tab, Card, CardBody} from "@nextui-org/react";
import {Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, getKeyValue} from "@nextui-org/react";

const rows = [
  {
    key: "1",
    count: 1,
    day: 1,
    month:1,
    years:1,
    address:"0x88A68278fE332846BACC78BB6c38310a357BEe06",
  },
  {
    key: "2",
    count: 1,
    day: 1,
    month:1,
    years:1,
    address:"0x88A68278fE332846BACC78BB6c38310a357BEe06"
  }
];

const columns = [
  {
    key: "address",
    label: "ADDRESS",
    // width:550
  },
  {
    key: "count",
    label: "跨链次数",
    // width:600
  },
  {
    key: "day",
    label: "活跃天数",
    // width:40
  },
  {
    key: "month",
    label: "活跃月数",
    // width:40
  },
  {
    key: "years",
    label: "活跃年数",
    // width:40
  }
];

type SelectedKey=[selectedKeys:any, setSelectedKeys:any]

export default function Tool() {
  const [selectedKeys, setSelectedKeys]:SelectedKey= React.useState(new Set([""]));


  return (
    <div className={styles.main}>
      {/* <div className={styles.content}>
        正在开发......
      </div> */}
      <Tabs aria-label="Options" size='lg' fullWidth={true} radius='full'>
        <Tab key="hyperlane" title="Hyperlane查询" className={styles.HyperlaneTab}>
          <Table 
            aria-label="Controlled table example with dynamic content"
            selectionMode="multiple"
            selectedKeys={selectedKeys}
            onSelectionChange={setSelectedKeys}
          >
            <TableHeader columns={columns}>
              {(column) => <TableColumn key={column.key}>{column.label}</TableColumn>}
            </TableHeader>
            <TableBody items={rows}>
              {(item) => (
                <TableRow key={item.key}>
                  {(columnKey) => <TableCell width={1000}>{getKeyValue(item, columnKey)}</TableCell>}
                </TableRow>
              )}
            </TableBody>
          </Table>
          {/* 数据操作 */}
        </Tab>
        <Tab key="music" title="开发中..." isDisabled>
          开发中... 
        </Tab>
        <Tab key="videos" title="开发中..." isDisabled>
          开发中... 
        </Tab>
      </Tabs>
    </div>
  )
}
