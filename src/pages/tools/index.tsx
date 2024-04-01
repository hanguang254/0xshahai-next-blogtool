import React, { useEffect, useState } from 'react'
import styles from './index.module.css'
import {Tabs, Tab, Card, CardBody} from "@nextui-org/react";
import {Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, getKeyValue} from "@nextui-org/react";
import {Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, useDisclosure} from "@nextui-org/react";
import {Textarea,CircularProgress,Spinner} from "@nextui-org/react";
import { ethers } from "ethers";

type SelectedKey=[selectedKeys:any, setSelectedKeys:any]

export default function Tool() {
    // const rows = [
    //   {
    //     key: "1",
    //     count: 1,
    //     day: 1,
    //     month:1,
    //     years:1,
    //     money:10000,
    //     address:"0x88A68278fE332846BACC78BB6c38310a357BEe06",
    //   },
    //   {
    //     key: "2",
    //     count: 1,
    //     day: 1,
    //     month:1,
    //     years:1,
    //     money:10000,
    //     address:"0x88A68278fE332846BACC78BB6c38310a357BEe06"
    //   }
    // ];

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
      },
      {
        key: "ETHgas",
        label: "使用费用/eth",
        // width:40
      }
    ];

const [selectedKeys, setSelectedKeys]:SelectedKey= React.useState(new Set([""]));
const {isOpen, onOpen, onClose} = useDisclosure();
const [size, setSize] = React.useState<'3xl' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' | 'xs' | '4xl' | '5xl'>('3xl');
//地址数组
const [address,setAddress] =useState([])

const [rows, setRows] = useState([]);

const [isLoading, setIsLoading] = useState(false); // 加载状态


//打开模态框
const handleOpen = () => {
  onOpen();
}

// 获取输入地址值
const handleinput=(value:any)=>{
  const array = value.split("\n")
  console.log(array);
  setAddress(array);
  
}

const APISearch=async (address:string)=>{
  const baseUrl = 'https://explorer.hyperlane.xyz/api';
  const action = 'module=message&action=search-messages';
  // const address = '0x88A68278fE332846BACC78BB6c38310a357BEe06'; // 要查询的地址
  const url = `${baseUrl}?${action}&query=${address}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {"Content-Type": "application/json"},
  });
  const data = await response.json();
  return data
}

// 时间戳换算

const timemath =(timestamp:any)=>{
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 月份从 0 开始，所以要加 1
  const day = date.getDate();
  console.log(year,month,day);
  
  return [year,month,day]
}

useEffect(() => {
  fetchData();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

const fetchData = async () => {
  setIsLoading(true);
  try {
    const cachedRows = localStorage.getItem('Rows');
    if (cachedRows) {
      const parsedRows = JSON.parse(cachedRows);
      await Promise.all(parsedRows.map(async (value: any) => {
        try {
          const res = await APISearch(value.address);
          const yearArray: any = [];
          const monthArray: any = [];
          const dayArray: any = [];
          res.result.forEach((tx: any) => {
            const [year, month, day] = timemath(tx.origin.timestamp);
            yearArray.push(year);
            monthArray.push(`${year}-${month}`);
            dayArray.push(`${month}-${day}`);
          });
          const uniqueYears = [...new Set(yearArray)];
          const uniqueMonths = [...new Set(monthArray)];
          const uniqueDays = [...new Set(dayArray)];

          value.years = uniqueYears.length;
          value.month = uniqueMonths.length;
          value.day = uniqueDays.length;
        } catch (error) {
          console.error('获取地址信息时出错：', error);
        }
      }));

      setRows(parsedRows);
      localStorage.setItem('Rows', JSON.stringify(parsedRows));
    } else {
      console.log('本地缓存中没有对应的数据');
    }
  } catch (error) {
    console.error('解析本地缓存数据时出错：', error);
  } finally {
    setIsLoading(false);
  }
};

const handleSearch = async() =>{
    setIsLoading(true); // 设置加载状态为 true
    const newRows:any = await Promise.all(address.map(async (addressItem) => {
      const res = await APISearch(addressItem);
      if (res.result && res.result.length > 0) {
        const message = res.result[0]; // 假设只取返回结果的第一个消息对象
        console.log(message);
        
        return {
          key: message.id, // 使用消息的 id 作为行的 key
          count: res.result.length || 0, // 假设 numPayments 表示跨链次数
          ETHgas: Number(ethers.formatEther(message.totalPayment))*res.result.length || 0,
          address: addressItem,
        };
      }
      return null;
    }));
    // 使用函数式更新，将新数据追加到现有数据之后
    setRows(prevRows => [...prevRows, ...newRows.filter(row => row !== null)]);

    setIsLoading(false);
    // 将新数据保存到本地存储
    localStorage.setItem('Rows', JSON.stringify([...rows, ...newRows.filter(row => row !== null)]));

    // 立即执行 useEffect
    fetchData();
}

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
            <TableBody 
              items={rows} 
              isLoading={isLoading}
              loadingContent={<CircularProgress label="Loading..." />}
            >
              {(item) => (
                <TableRow key={item.key}>
                  {(columnKey) => <TableCell width={1000}>{getKeyValue(item, columnKey)}</TableCell>}
                </TableRow>
              )}
            </TableBody>
          </Table>
          {/* 数据操作 */}
          <div className="flex flex-wrap gap-3">
            <Button isLoading={isLoading} color='primary' key={size} onPress={()=>{handleOpen()}}>添加地址</Button>
            <Button isLoading={isLoading} color='primary' key={size} onPress={()=>{}} isDisabled>选择删除</Button>
          </div>
          <Modal 
            size={size} 
            isOpen={isOpen} 
            onClose={onClose} 
          >
            <ModalContent>
              {(onClose) => (
                <>
                  <ModalHeader className="flex flex-col gap-1">批量添加地址</ModalHeader>
                  <ModalBody>
                      <Textarea
                        label="地址输入"
                        placeholder="一行一个地址,建议一次添加地址不要超过20个，无交互记录的地址不展示"
                        size='lg'
                        fullWidth={true}
                        minRows={10}
                        maxRows={20}
                        onChange={(event)=>{handleinput(event.target.value)}}
                      />
                  </ModalBody>
                  <ModalFooter>
                    <Button color="danger" variant="light" onPress={onClose}>
                      关闭
                    </Button>
                    <Button color="primary" onPress={onClose} onClick={()=>{handleSearch()}}>
                      确定
                    </Button>
                  </ModalFooter>
                </>
              )}
            </ModalContent>
          </Modal>
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
