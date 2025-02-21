import React from 'react'
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    useDisclosure,
    useDraggable,
    Input
  } from "@heroui/react";

import {Card, CardBody, CardFooter, Image} from "@heroui/react";
import styles from "./index.module.css"

// 为不同的模态框创建不同的内容组件
const Monad1Content = ({ onClose ,...moveProps}) => {
    const [inputValue, setInputValue] = React.useState("");
    
    return (
        <>
            <ModalHeader {...moveProps} className="flex flex-col gap-1">
                Monad 1 Details
            </ModalHeader>
            <ModalBody>
                <Input
                    label="输入金额"
                    placeholder="请输入数值"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                />
            </ModalBody>
            <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Close
                </Button>
                <Button color="primary" onPress={onClose}>
                  Action
                </Button>
              </ModalFooter>
        </>
    );
};

const Monad2Content = ({ onClose, ...moveProps }) => {
    return (
        <>
            <ModalHeader {...moveProps} className="flex flex-col gap-1">
                Monad 2 Details
            </ModalHeader>
            <ModalBody>
                <div>这是完全不同的内容</div>
                <Button color="secondary">其他操作</Button>
            </ModalBody>
            <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Close
                </Button>
                <Button color="primary" onPress={onClose}>
                  Action
                </Button>
            </ModalFooter>
        </>
    );
};

const Monad3Content = ({ onClose,...moveProps }) => {
    return (
        <>
            <ModalHeader {...moveProps} className="flex flex-col gap-1">
                Monad 3 Details
            </ModalHeader>
            <ModalBody>
                <p>第三个模态框的独特内容</p>
                {/* 添加你想要的任何组件 */}
            </ModalBody>
            <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Close
                </Button>
                <Button color="primary" onPress={onClose}>
                  Action
                </Button>
            </ModalFooter>
        </>
    );
};

export default function Monad() {
    const {isOpen, onOpen, onOpenChange} = useDisclosure();
    const targetRef = React.useRef(null);
    const {moveProps} = useDraggable({targetRef, isDisabled: !isOpen});

    const list = [
        {
            title: "合约分发水工具",
            img: "/images/fruit-1.jpeg",
            // price: "$5.50",
            content: Monad1Content
        },
        {
            title: "Monad 2",
            img: "/images/fruit-1.jpeg",
            // price: "$5.50",
            content: Monad2Content
        },
        {
            title: "Monad 3",
            img: "/images/fruit-1.jpeg",
            // price: "$5.50",
            content: Monad3Content
        },
    ];

    const [selectedItem, setSelectedItem] = React.useState(null);

    const handleCardPress = (item) => {
        setSelectedItem(item);
        onOpen();
    };

    return (
        <>
        {/* <Button onPress={onOpen}>分发水</Button> */}
        
        <div className="gap-2 grid grid-cols-2 sm:grid-cols-4" >
            {list.map((item, index) => (
                /* eslint-disable no-console */
                <Card key={index} 
                isPressable 
                shadow="sm" 
                onPress={() => handleCardPress(item)}>
                <CardBody className="overflow-visible p-0">
                    <Image
                    alt={item.title}
                    className="w-full object-cover h-[140px]"
                    radius="lg"
                    shadow="sm"
                    src={item.img}
                    width="100%"
                    />
                </CardBody>
                <CardFooter className="text-small justify-center">
                    <b>{item.title}</b>
                    {/* <p className="text-default-500">{item.price}</p> */}
                </CardFooter>
                </Card>
            ))}
        </div>
        {/* 可移动模态框 */}
        <Modal 
            ref={targetRef} 
            isOpen={isOpen} 
            onOpenChange={onOpenChange}
            isDismissable={false}
            placement="center"
        >
            <ModalContent>
                {(onClose) => (
                    selectedItem?.content && <selectedItem.content onClose={onClose} {...moveProps} />
                )}
            </ModalContent>
        </Modal>
        </>
    )
}
